import type { Client } from 'whatsapp-web.js';
import { logger } from '../logger';
import { normalizeNumber } from '../utils/phone';

/**
 * WhatsApp privacy LIDs: many chats are addressed as `<opaque-id>@lid` instead
 * of `<phone>@c.us`. Normalizing a LID jid yields opaque digits that never match
 * the whitelist, so live ingestion must resolve LIDs to real phone numbers
 * before the whitelist check (same getContactLidAndPhone() approach as
 * GET /contacts). Resolutions are cached in memory so each unique LID costs at
 * most one lookup per process lifetime.
 */
const lidToPhone = new Map<string, string>();

/**
 * Normalize any contact jid to a real phone number (digits only). Non-LID jids
 * are normalized directly; LID jids are resolved via the live client. Falls
 * back to the opaque LID digits if resolution fails (message will then be
 * treated as non-whitelisted — the pre-resolver behavior).
 */
export async function resolveContactNumber(client: Client | null, jid: string): Promise<string> {
  if (!jid.endsWith('@lid')) return normalizeNumber(jid);

  const cached = lidToPhone.get(jid);
  if (cached) return cached;

  try {
    const [resolved] = (await client?.getContactLidAndPhone([jid])) ?? [];
    const phone = resolved?.pn ? normalizeNumber(resolved.pn) : '';
    if (phone) {
      lidToPhone.set(jid, phone);
      return phone;
    }
  } catch (err) {
    logger.warn({ err, jid }, 'LID→phone resolution failed; falling back to LID digits');
  }
  return normalizeNumber(jid);
}
