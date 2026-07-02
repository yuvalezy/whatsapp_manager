/**
 * Normalize a phone number or WhatsApp id to digits only.
 * Examples:
 *   "+1 (415) 555-0100"   -> "14155550100"
 *   "14155550100@c.us"    -> "14155550100"
 *   "123-456@g.us"        -> "123456"
 */
export function normalizeNumber(input: string): string {
  if (!input) return '';
  const withoutSuffix = input.split('@')[0];
  return withoutSuffix.replace(/\D/g, '');
}

/** Basic sanity check for an E.164-ish number (7–15 digits). */
export function isValidNumber(input: string): boolean {
  const digits = normalizeNumber(input);
  return digits.length >= 7 && digits.length <= 15;
}

/** Build the WhatsApp individual chat id for a normalized number. */
export function toChatId(number: string): string {
  return `${normalizeNumber(number)}@c.us`;
}

/** Build the WhatsApp group chat id for a normalized group id. */
export function toGroupChatId(groupId: string): string {
  return `${normalizeNumber(groupId)}@g.us`;
}
