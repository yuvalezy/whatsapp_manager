import { query } from '../db';
import { logger } from '../logger';
import { normalizeNumber, isValidNumber } from '../utils/phone';

export type PreferredLanguage = 'es' | 'en' | 'he';

export interface WhitelistEntry {
  id: number;
  phone_number: string;
  label: string | null;
  created_at: string;
  ezy_bp_id: string | null;
  ezy_bp_code: string | null;
  ezy_bp_name: string | null;
  ezy_contact_id: string | null;
  ezy_contact_name: string | null;
  ezy_linked_at: string | null;
  preferred_language: PreferredLanguage;
}

export interface EzyLinkInput {
  bpId: string;
  bpCode: string;
  bpName: string;
  contactId: string;
  contactName: string;
}

const ENTRY_COLUMNS =
  'id, phone_number, label, created_at, ezy_bp_id, ezy_bp_code, ezy_bp_name, ezy_contact_id, ezy_contact_name, ezy_linked_at, preferred_language';

export class ValidationError extends Error {}

/**
 * Source of truth for "who are we allowed to process".
 * Numbers are cached in memory for O(1) checks on the hot message path;
 * the cache is kept in sync with the DB on every mutation.
 */
class WhitelistService {
  private cache = new Set<string>();

  /** Load the whitelist from the DB into memory. Call once at startup. */
  async load(): Promise<void> {
    const { rows } = await query<{ phone_number: string }>(
      'SELECT phone_number FROM whitelist',
    );
    this.cache = new Set(rows.map((r) => r.phone_number));
    logger.info({ count: this.cache.size }, 'Whitelist loaded');
  }

  isWhitelisted(number: string): boolean {
    return this.cache.has(normalizeNumber(number));
  }

  size(): number {
    return this.cache.size;
  }

  async list(): Promise<WhitelistEntry[]> {
    const { rows } = await query<WhitelistEntry>(
      `SELECT ${ENTRY_COLUMNS} FROM whitelist ORDER BY created_at DESC`,
    );
    return rows;
  }

  async add(rawNumber: string, label?: string): Promise<WhitelistEntry> {
    const phone = normalizeNumber(rawNumber);
    if (!isValidNumber(phone)) {
      throw new ValidationError(
        `Invalid phone number: "${rawNumber}". Use digits with country code, e.g. 14155550100.`,
      );
    }
    const { rows } = await query<WhitelistEntry>(
      `INSERT INTO whitelist (phone_number, label)
       VALUES ($1, $2)
       ON CONFLICT (phone_number) DO UPDATE SET label = EXCLUDED.label
       RETURNING ${ENTRY_COLUMNS}`,
      [phone, label ?? null],
    );
    this.cache.add(phone);
    logger.info({ phone }, 'Whitelist entry added');
    return rows[0];
  }

  /** Link (or replace the link on) a whitelist entry to an EZY Portal BP + contact. */
  async setEzyLink(id: number, link: EzyLinkInput): Promise<WhitelistEntry | null> {
    const { rows } = await query<WhitelistEntry>(
      `UPDATE whitelist
          SET ezy_bp_id = $2, ezy_bp_code = $3, ezy_bp_name = $4,
              ezy_contact_id = $5, ezy_contact_name = $6, ezy_linked_at = now()
        WHERE id = $1
        RETURNING ${ENTRY_COLUMNS}`,
      [id, link.bpId, link.bpCode, link.bpName, link.contactId, link.contactName],
    );
    if (rows[0]) logger.info({ id, bpId: link.bpId, contactId: link.contactId }, 'Whitelist entry linked to EZY Portal');
    return rows[0] ?? null;
  }

  /**
   * Bump the running per-language counter for an inbound message and
   * recompute `preferred_language` (majority of es/en/he counts; ties and
   * everything else default to 'es'). Self-corrects over time instead of
   * letting one ambiguous message flip the setting.
   */
  async recordInboundLanguage(rawNumber: string, lang: PreferredLanguage): Promise<void> {
    const phone = normalizeNumber(rawNumber);
    await query(
      `WITH updated AS (
         UPDATE whitelist
            SET lang_es_count = lang_es_count + ($2 = 'es')::int,
                lang_en_count = lang_en_count + ($2 = 'en')::int,
                lang_he_count = lang_he_count + ($2 = 'he')::int
          WHERE phone_number = $1
          RETURNING id, lang_es_count, lang_en_count, lang_he_count
       )
       UPDATE whitelist w
          SET preferred_language = CASE
                WHEN updated.lang_en_count > updated.lang_es_count
                     AND updated.lang_en_count >= updated.lang_he_count THEN 'en'
                WHEN updated.lang_he_count > updated.lang_es_count
                     AND updated.lang_he_count > updated.lang_en_count THEN 'he'
                ELSE 'es'
              END
         FROM updated
        WHERE w.id = updated.id`,
      [phone, lang],
    );
  }

  /**
   * Return a contact's preferred language (majority vote from inbound messages).
   * Falls back to 'es' for contacts without whitelist entries.
   */
  async getPreferredLanguage(rawNumber: string): Promise<PreferredLanguage> {
    const phone = normalizeNumber(rawNumber);
    const { rows } = await query<{ preferred_language: PreferredLanguage }>(
      'SELECT preferred_language FROM whitelist WHERE phone_number = $1',
      [phone],
    );
    return rows[0]?.preferred_language ?? 'es';
  }

  async remove(rawNumber: string): Promise<boolean> {
    const phone = normalizeNumber(rawNumber);
    const { rowCount } = await query('DELETE FROM whitelist WHERE phone_number = $1', [phone]);
    this.cache.delete(phone);
    const removed = (rowCount ?? 0) > 0;
    if (removed) logger.info({ phone }, 'Whitelist entry removed');
    return removed;
  }
}

export const whitelistService = new WhitelistService();
