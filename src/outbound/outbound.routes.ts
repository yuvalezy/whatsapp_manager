import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { logger } from '../logger';
import { whatsappService } from '../whatsapp/client';
import { whitelistService } from '../whitelist/whitelist.service';
import { messageService } from '../messages/message.service';
import { buildRoutable } from '../whatsapp/message-mapper';
import { normalizeNumber, toChatId } from '../utils/phone';

/**
 * Outbound is a SAFE SCAFFOLD ONLY — disabled by default (ENABLE_OUTBOUND=false).
 * Even when enabled it is deliberately constrained:
 *   • rate limited
 *   • single recipient per call (no bulk)
 *   • recipient must be whitelisted
 * This exists so a future MessageRouter can reply without re-plumbing safety.
 */
export const outboundRouter = Router();

const limiter = rateLimit({
  windowMs: env.OUTBOUND_RATE_LIMIT_WINDOW_MS,
  limit: env.OUTBOUND_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
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

// POST /outbound/send — { number, message }
outboundRouter.post('/send', limiter, async (req, res, next) => {
  try {
    const { number, message } = (req.body ?? {}) as { number?: unknown; message?: unknown };
    if (!number || !message) {
      res.status(400).json({ error: '"number" and "message" are required' });
      return;
    }

    const phone = normalizeNumber(String(number));
    if (!whitelistService.isWhitelisted(phone)) {
      res.status(403).json({ error: 'Recipient is not whitelisted' });
      return;
    }

    const client = whatsappService.getClient();
    if (!client || whatsappService.getState() !== 'READY') {
      res.status(503).json({ error: 'WhatsApp client is not ready' });
      return;
    }

    const sent = await client.sendMessage(toChatId(phone), String(message));
    logger.warn({ to: phone, messageId: sent.id._serialized }, 'OUTBOUND message sent');

    // Pin the thread key: `sent.to` can come back LID-addressed even when we
    // sent to the @c.us chat id, and the recipient number is already known.
    const routable = await buildRoutable(sent, whatsappService.getOwnNumber(), phone);
    await messageService.save(routable).catch((err) =>
      logger.error({ err, messageId: sent.id._serialized }, 'Failed to persist own outbound message'),
    );

    res.status(201).json({ data: { messageId: sent.id._serialized } });
  } catch (err) {
    next(err);
  }
});
