/**
 * WhatsApp system / non-conversational message types that must never be
 * persisted as conversation rows (group-membership notices, protocol frames,
 * ciphertext placeholders, revoked stubs, call logs, …).
 *
 * Shared by history backfill and live ingestion so both drop the same junk and
 * produce identical rows. Without this guard on the live path, monitored groups
 * accumulate empty system rows.
 */
export const SKIP_TYPES = new Set<string>([
  'e2e_notification',
  'notification',
  'notification_template',
  'gp2',
  'group_notification',
  'protocol',
  'ciphertext',
  'revoked',
  'call_log',
  'broadcast_notification',
  'debug',
]);

/** True when a message type is a system/non-conversational frame we don't store. */
export function isSkippableType(type: string): boolean {
  return SKIP_TYPES.has(type);
}
