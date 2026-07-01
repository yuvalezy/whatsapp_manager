import { query } from '../db';
import { logger } from '../logger';
import { normalizeNumber, isValidNumber } from '../utils/phone';

export interface WhitelistEntry {
  id: number;
  phone_number: string;
  label: string | null;
  created_at: string;
}

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
      'SELECT id, phone_number, label, created_at FROM whitelist ORDER BY created_at DESC',
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
       RETURNING id, phone_number, label, created_at`,
      [phone, label ?? null],
    );
    this.cache.add(phone);
    logger.info({ phone }, 'Whitelist entry added');
    return rows[0];
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
