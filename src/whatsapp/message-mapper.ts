import type { Client, Contact, Message } from 'whatsapp-web.js';
import { normalizeNumber } from '../utils/phone';
import { detectLanguageHint } from '../utils/language';
import { downloadAndStore } from '../media/media.service';
import { resolveContactNumber } from './lid-resolver';
import { RoutableMedia, RoutableMention, RoutableMessage } from '../messages/message.model';

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

/** The chat this message belongs to: fromMe ? recipient : sender (direction-aware). */
export function chatIdOf(message: Message): string {
  return (message.id.fromMe ? message.to : message.from) ?? '';
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
 *
 * `client` is used to resolve any @mentions in the body (`message.mentionedIds`)
 * to a real phone number — LID-aware, same as author/contact resolution above —
 * so the frontend can cross-reference the whitelist. Omitted only when no live
 * client is available; mentions then fall back to their raw (possibly LID)
 * digits, unresolved.
 */
export async function buildRoutable(
  message: Message,
  ownNumber: string,
  contactNumberOverride?: string,
  senderNumberOverride?: string,
  mediaOverride?: RoutableMedia,
  client?: Client | null,
): Promise<RoutableMessage> {
  const fromMe = message.id.fromMe;
  const chatId = chatIdOf(message);
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

  // @mentions: `id` mirrors the body's literal "@<id>" placeholder digits;
  // `number` resolves LID-aware (same as senderName/author above) so the
  // frontend can match against the whitelist; `name` is the WhatsApp contact's
  // own display name, captured now (same pushname/name/verifiedName fallback
  // as senderName) so a non-whitelisted mention still shows a real name.
  let mentions: RoutableMention[] | undefined;
  if (message.mentionedIds?.length) {
    let mentionContacts: Contact[] = [];
    try {
      mentionContacts = await message.getMentions();
    } catch {
      /* contact lookup is optional, same as senderName above */
    }
    mentions = [];
    for (const rawId of message.mentionedIds as unknown as (string | { _serialized: string })[]) {
      // Despite the `string[]` type, whatsapp-web.js's own getMentions() (above)
      // shows entries can also arrive as WID objects — same defensive unwrap.
      const jid = typeof rawId === 'string' ? rawId : rawId._serialized;
      if (!jid) continue;
      const id = normalizeNumber(jid);
      const number = client ? await resolveContactNumber(client, jid) : id;
      const contact = mentionContacts.find((c) => c.id._serialized === jid);
      const name = contact ? contact.pushname || contact.name || contact.verifiedName || null : null;
      mentions.push({ id, number, name });
    }
  }

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
    mentions,
    metadata: {
      hasMedia: message.hasMedia,
      isForwarded: message.isForwarded,
      deviceType: message.deviceType,
      isGroup,
      fromMe,
    },
  };
}
