import type { Message } from 'whatsapp-web.js';
import { normalizeNumber } from '../utils/phone';
import { detectLanguageHint } from '../utils/language';
import { downloadAndStore } from '../media/media.service';
import { RoutableMessage } from '../messages/message.model';

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
 * upfront). It also keys the media folder, so it must be applied here rather
 * than patched onto the result.
 */
export async function buildRoutable(
  message: Message,
  ownNumber: string,
  contactNumberOverride?: string,
): Promise<RoutableMessage> {
  const fromMe = message.id.fromMe;
  const isGroup = (message.from ?? '').endsWith('@g.us');
  const contactNumber = contactNumberOverride || contactNumberOf(message);
  const chatId = (fromMe ? message.to : message.from) ?? '';
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

  const media = await downloadAndStore(message, contactNumber);

  return {
    messageId: message.id._serialized,
    chatId,
    contactNumber,
    senderNumber: fromMe ? ownNumber : contactNumber,
    senderName,
    body,
    messageType: String(message.type),
    direction: fromMe ? 'outbound' : 'inbound',
    timestamp: new Date(message.timestamp * 1000),
    detectedLanguage: body ? detectLanguageHint(body) : undefined,
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
