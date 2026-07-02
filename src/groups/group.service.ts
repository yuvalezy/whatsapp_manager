import { query } from '../db';
import { logger } from '../logger';
import { normalizeNumber } from '../utils/phone';

export interface GroupEntry {
  id: number;
  group_id: string;
  chat_id: string;
  subject: string | null;
  created_at: string;
  ezy_bp_id: string | null;
  ezy_bp_code: string | null;
  ezy_bp_name: string | null;
  ezy_contact_id: string | null;
  ezy_contact_name: string | null;
  ezy_linked_at: string | null;
}

/** BP-only link — a group is attached to a business partner without a contact. */
export interface GroupEzyLinkInput {
  bpId: string;
  bpCode: string;
  bpName: string;
}

const ENTRY_COLUMNS =
  'id, group_id, chat_id, subject, created_at, ezy_bp_id, ezy_bp_code, ezy_bp_name, ezy_contact_id, ezy_contact_name, ezy_linked_at';

export class ValidationError extends Error {}

/**
 * Source of truth for "which groups do we monitor". Group ids are cached in
 * memory for O(1) checks on the hot message path (mirrors WhitelistService);
 * the cache is kept in sync with the DB on every mutation. A group is captured
 * ONLY if it is in this registry — there is no global "monitor all groups" flag.
 */
class GroupService {
  private cache = new Set<string>();

  /** Load the monitored-group ids from the DB into memory. Call once at startup. */
  async load(): Promise<void> {
    const { rows } = await query<{ group_id: string }>('SELECT group_id FROM groups');
    this.cache = new Set(rows.map((r) => r.group_id));
    logger.info({ count: this.cache.size }, 'Monitored groups loaded');
  }

  isMonitored(groupId: string): boolean {
    return this.cache.has(normalizeNumber(groupId));
  }

  size(): number {
    return this.cache.size;
  }

  async list(): Promise<GroupEntry[]> {
    const { rows } = await query<GroupEntry>(
      `SELECT ${ENTRY_COLUMNS} FROM groups ORDER BY created_at DESC`,
    );
    return rows;
  }

  /** Register a group for monitoring. `rawGroupId` may be a jid (`…@g.us`) or digits. */
  async add(rawGroupId: string, chatId: string, subject?: string): Promise<GroupEntry> {
    const groupId = normalizeNumber(rawGroupId);
    if (!groupId) {
      throw new ValidationError(`Invalid group id: "${rawGroupId}".`);
    }
    const { rows } = await query<GroupEntry>(
      `INSERT INTO groups (group_id, chat_id, subject)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, subject = EXCLUDED.subject
       RETURNING ${ENTRY_COLUMNS}`,
      [groupId, chatId, subject ?? null],
    );
    this.cache.add(groupId);
    logger.info({ groupId }, 'Group added to monitoring');
    return rows[0];
  }

  /** Link (or replace the link on) a monitored group to an EZY Portal BP — no contact. */
  async setEzyLink(id: number, link: GroupEzyLinkInput): Promise<GroupEntry | null> {
    const { rows } = await query<GroupEntry>(
      `UPDATE groups
          SET ezy_bp_id = $2, ezy_bp_code = $3, ezy_bp_name = $4, ezy_linked_at = now()
        WHERE id = $1
        RETURNING ${ENTRY_COLUMNS}`,
      [id, link.bpId, link.bpCode, link.bpName],
    );
    if (rows[0]) logger.info({ id, bpId: link.bpId }, 'Group linked to EZY Portal business partner');
    return rows[0] ?? null;
  }

  async remove(rawGroupId: string): Promise<boolean> {
    const groupId = normalizeNumber(rawGroupId);
    const { rowCount } = await query('DELETE FROM groups WHERE group_id = $1', [groupId]);
    this.cache.delete(groupId);
    const removed = (rowCount ?? 0) > 0;
    if (removed) logger.info({ groupId }, 'Group removed from monitoring');
    return removed;
  }
}

export const groupService = new GroupService();
