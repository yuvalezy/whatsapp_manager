import type { Message } from 'whatsapp-web.js';
import { normalizeNumber } from '../utils/phone';
import { detectLanguageHint } from '../utils/language';
import { downloadAndStore } from '../media/media.service';
import { RoutableMedia, RoutableMessage } from '../messages/message.model';

/**
 * Maps a `whatsapp-web.js` Message into our canonical `RoutableMessage`,
 * including downloading any attachment to disk. Shared by live ingestion
 * (events.ts) and history backfill (backfill.service.ts) so both paths produce
 * identical rows. The whitelist/ignored POLICY stays in events.ts.
 */

/** The other party's raw jid (may be `@c.us` or a privacy `@lid`). */
export function contactJidOf(message: Message): string {
  const isGroup = (message.from ?? '').endsWith('@g.us');
  const raw = message.id.fromMe
    ? message.to
    : isGroup
      ? (message.author ?? message.from)
      : message.from;
  return raw ?? '';
}

/** The other party of the thread (normalized): fromMe ? recipient : sender. */
export function contactNumberOf(message: Message): string {
  return normalizeNumber(contactJidOf(message));
}

/**
 * `contactNumberOverride` pins the thread key when the caller already knows the
 * real phone number — required whenever the chat is LID-addressed (live
 * ingestion resolves it via lid-resolver; backfill/outbound know the number
 * upfront) and for groups (the thread key is the group id). It also keys the
 * media folder, so it must be applied here rather than patched onto the result.
 *
 * `senderNumberOverride` pins the actual author for group messages, where the
 * thread key (contactNumber = group id) differs from who sent the message. For
 * 1:1 it is omitted and the sender collapses to the contact (or own number).
 *
 * `mediaOverride` skips `downloadAndStore` entirely when the caller already
 * knows the media (outbound sends with an attachment already have the exact
 * bytes they uploaded) — `message.downloadMedia()` on our own just-sent echo
 * can block on WhatsApp's own upload pipeline or hand back a recompressed
 * copy, so re-deriving it here would be both wasteful and untrustworthy.
 */
export async function buildRoutable(
  message: Message,
  ownNumber: string,
  contactNumberOverride?: string,
  senderNumberOverride?: string,
  mediaOverride?: RoutableMedia,
): Promise<RoutableMessage> {
  const fromMe = message.id.fromMe;
  const chatId = (fromMe ? message.to : message.from) ?? '';
  const isGroup = chatId.endsWith('@g.us');
  const contactNumber = contactNumberOverride || contactNumberOf(message);
  const body = message.body ?? '';

  let senderName: string | undefined;
  if (fromMe) {
    senderName = 'You';
  } else {
    try {
      const contact = await message.getContact();
      senderName = contact.pushname || contact.name || contact.verifiedName || undefined;
    } catch {
      /* contact lookup is optional */
    }
  }

  const media = mediaOverride ?? (await downloadAndStore(message, contactNumber));

  // Reply/quote link. getQuotedMessage() is async but only fires when this
  // message actually quotes another; its id._serialized matches the format we
  // store as message_id, so the reference resolves against our own rows. Shared
  // by live ingestion and backfill (both call buildRoutable).
  let replyToMessageId: string | null = null;
  if (message.hasQuotedMsg) {
    try {
      const quoted = await message.getQuotedMessage();
      replyToMessageId = quoted?.id?._serialized ?? null;
    } catch {
      /* quoted message not resolvable (not in cache) — leave null */
    }
  }

  return {
    messageId: message.id._serialized,
    chatId,
    contactNumber,
    senderNumber: senderNumberOverride ?? (fromMe ? ownNumber : contactNumber),
    senderName,
    body,
    messageType: String(message.type),
    direction: fromMe ? 'outbound' : 'inbound',
    timestamp: new Date(message.timestamp * 1000),
    detectedLanguage: body ? detectLanguageHint(body) : undefined,
    ack: message.ack,
    replyToMessageId,
    media,
    metadata: {
      hasMedia: message.hasMedia,
      isForwarded: message.isForwarded,
      deviceType: message.deviceType,
      isGroup,
      fromMe,
    },
  };
}
