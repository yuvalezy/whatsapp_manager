import { query } from '../db';
import { normalizeNumber } from '../utils/phone';

export interface ConversationRead {
  thread_id: string;
  last_read_at: string;
}

/**
 * Owns the `conversation_reads` table — one "last read" watermark per thread.
 * The thread id is the same key used across the app: a phone number for 1:1
 * contacts, a group id for monitored groups (both normalized digit strings).
 * No in-memory cache: it is read once per inbox load and written on demand.
 */
class ReadStateService {
  /** All read watermarks, for computing unread counts in the threads route. */
  async list(): Promise<ConversationRead[]> {
    const { rows } = await query<ConversationRead>(
      'SELECT thread_id, last_read_at FROM conversation_reads',
    );
    return rows;
  }

  /** Mark a thread read up to now (idempotent upsert). */
  async markRead(rawThreadId: string): Promise<void> {
    const threadId = normalizeNumber(rawThreadId);
    if (!threadId) return;
    await query(
      `INSERT INTO conversation_reads (thread_id, last_read_at)
       VALUES ($1, now())
       ON CONFLICT (thread_id) DO UPDATE SET last_read_at = now()`,
      [threadId],
    );
  }
}

export const readStateService = new ReadStateService();
