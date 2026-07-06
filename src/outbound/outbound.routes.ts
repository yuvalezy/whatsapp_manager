import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MessageMedia } from 'whatsapp-web.js';
import { env } from '../config/env';
import { logger } from '../logger';
import { whatsappService } from '../whatsapp/client';
import { whitelistService } from '../whitelist/whitelist.service';
import { groupService } from '../groups/group.service';
import { messageService } from '../messages/message.service';
import { buildRoutable } from '../whatsapp/message-mapper';
import { storeOutboundMedia } from '../media/media.service';
import { normalizeNumber, toChatId, toGroupChatId } from '../utils/phone';

/**
 * Outbound is a SAFE SCAFFOLD ONLY — disabled by default (ENABLE_OUTBOUND=false).
 * Even when enabled it is deliberately constrained:
 *   • rate limited
 *   • single recipient per call (no bulk)
 *   • recipient must be whitelisted (contact) or a monitored group
 * This exists so a future MessageRouter can reply without re-plumbing safety.
 */
export const outboundRouter = Router();

const limiter = rateLimit({
  windowMs: env.OUTBOUND_RATE_LIMIT_WINDOW_MS,
  limit: env.OUTBOUND_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Single global bucket, not per-IP: this is an account-wide safety ceiling on
  // how fast we can send, so every caller shares the same limit.
  keyGenerator: () => 'global',
  message: { error: 'Rate limit exceeded for outbound sending' },
});

// Hard gate: refuse everything unless explicitly enabled.
outboundRouter.use((_req, res, next) => {
  if (!env.ENABLE_OUTBOUND) {
    res.status(403).json({
      error: 'Outbound messaging is disabled. Set ENABLE_OUTBOUND=true to enable.',
    });
    return;
  }
  next();
});

// POST /outbound/send — { number, message } for a whitelisted contact, OR
// { groupId, message } for a monitored group. Exactly one target. An optional
// `quotedMessageId` (a stored message_id from the same thread) sends the reply
// as a WhatsApp quote of that message. An optional `attachment`
// ({ data: base64, mimetype, filename? }) sends a media message — `message`
// then becomes its caption (and may be omitted entirely for an unlabeled send).
outboundRouter.post('/send', limiter, async (req, res, next) => {
  try {
    const { number, message, groupId, quotedMessageId, attachment, mentions } = (req.body ?? {}) as {
      number?: unknown;
      message?: unknown;
      groupId?: unknown;
      quotedMessageId?: unknown;
      attachment?: unknown;
      mentions?: unknown;
    };

    const hasMessage = typeof message === 'string' && message.trim() !== '';

    // Optional @mentions — serialized WIDs (`<number>@c.us` / `<lid>@lid`). The
    // body (`message`) must already carry the matching `@<user>` tokens (the
    // frontend builds both together); we just forward the jids to whatsapp-web.js.
    let mentionJids: string[] = [];
    if (mentions !== undefined) {
      if (
        !Array.isArray(mentions) ||
        !mentions.every((m) => typeof m === 'string' && (m.endsWith('@c.us') || m.endsWith('@lid')))
      ) {
        res.status(400).json({ error: '"mentions" must be an array of "<id>@c.us"/"<id>@lid" jids' });
        return;
      }
      mentionJids = mentions as string[];
    }

    // Validated + size-capped BEFORE any whitelist lookup or WhatsApp send —
    // cheapest checks first, and we never want to burn an irreversible send on
    // a payload we'd reject anyway.
    let media: { buffer: Buffer; base64: string; mimetype: string; filename?: string } | undefined;
    if (attachment !== undefined) {
      const a = attachment as { data?: unknown; mimetype?: unknown; filename?: unknown };
      if (typeof a?.data !== 'string' || !a.data || typeof a?.mimetype !== 'string' || !a.mimetype) {
        res
          .status(400)
          .json({ error: '"attachment" must be { data: base64 string, mimetype: string, filename?: string }' });
        return;
      }
      const buffer = Buffer.from(a.data, 'base64');
      if (buffer.length === 0) {
        res.status(400).json({ error: '"attachment.data" decoded to an empty file' });
        return;
      }
      if (env.OUTBOUND_MEDIA_MAX_BYTES > 0 && buffer.length > env.OUTBOUND_MEDIA_MAX_BYTES) {
        res.status(413).json({ error: `Attachment exceeds the ${env.OUTBOUND_MEDIA_MAX_BYTES}-byte outbound limit` });
        return;
      }
      media = {
        buffer,
        base64: a.data,
        mimetype: a.mimetype,
        filename: typeof a.filename === 'string' ? a.filename : undefined,
      };
    }

    if ((!hasMessage && !media) || (!number && !groupId)) {
      res
        .status(400)
        .json({ error: 'One of "message" / "attachment", and one of "number" / "groupId", are required' });
      return;
    }

    // Resolve the target (gate + chat id + thread key) up front.
    let chatId: string;
    let threadKey: string;
    if (groupId) {
      threadKey = normalizeNumber(String(groupId));
      if (!groupService.isMonitored(threadKey)) {
        res.status(403).json({ error: 'Group is not monitored' });
        return;
      }
      chatId = toGroupChatId(threadKey);
    } else {
      threadKey = normalizeNumber(String(number));
      if (!whitelistService.isWhitelisted(threadKey)) {
        res.status(403).json({ error: 'Recipient is not whitelisted' });
        return;
      }
      chatId = toChatId(threadKey);
    }

    // A quote target must already belong to this same thread — refuse anything
    // we can't find or that was captured on a different contact/group.
    let quoteId: string | undefined;
    if (quotedMessageId) {
      quoteId = String(quotedMessageId);
      const quoted = await messageService.getByMessageId(quoteId);
      if (!quoted || quoted.contact_number !== threadKey) {
        res.status(400).json({ error: 'quotedMessageId does not belong to this thread' });
        return;
      }
    }

    const client = whatsappService.getClient();
    if (!client || whatsappService.getState() !== 'READY') {
      res.status(503).json({ error: 'WhatsApp client is not ready' });
      return;
    }

    const sendOptions = {
      ...(quoteId ? { quotedMessageId: quoteId } : {}),
      ...(mentionJids.length ? { mentions: mentionJids } : {}),
    };
    const sent = media
      ? await client.sendMessage(
          chatId,
          new MessageMedia(media.mimetype, media.base64, media.filename, media.buffer.length),
          { caption: hasMessage ? String(message) : undefined, ...sendOptions },
        )
      : await client.sendMessage(chatId, String(message), sendOptions);
    logger.warn(
      { to: threadKey, messageId: sent.id._serialized, hasMedia: Boolean(media), mentions: mentionJids.length },
      'OUTBOUND message sent',
    );

    // Store OUR OWN bytes when there's an attachment — never re-derive via
    // sent.downloadMedia() (see buildRoutable's mediaOverride doc: it can
    // block on WhatsApp's own upload pipeline or hand back a recompressed copy).
    const storedMedia = media
      ? await storeOutboundMedia(media.buffer, media.mimetype, threadKey, sent.id._serialized, media.filename)
      : undefined;

    // Pin the thread key: `sent.to` can come back LID-addressed even when we
    // sent to the @c.us/@g.us chat id, and the target is already known.
    const routable = await buildRoutable(
      sent,
      whatsappService.getOwnNumber(),
      threadKey,
      undefined,
      storedMedia,
      client,
    );
    // Safety net: don't rely on the SDK's local echo re-deriving the quote.
    if (quoteId) routable.replyToMessageId = quoteId;
    await messageService.save(routable).catch((err) =>
      logger.error({ err, messageId: sent.id._serialized }, 'Failed to persist own outbound message'),
    );

    res.status(201).json({ data: { messageId: sent.id._serialized } });
  } catch (err) {
    next(err);
  }
});
