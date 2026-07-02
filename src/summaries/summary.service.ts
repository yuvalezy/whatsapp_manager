import { query } from '../db';
import { normalizeNumber } from '../utils/phone';

export interface SummaryEntry {
  id: number;
  contact_number: string;
  title: string;
  body: string;
  window_minutes: number;
  window_start: string;
  window_end: string;
  message_count: number;
  image_count: number;
  created_at: string;
}

export interface CreateSummaryInput {
  contactNumber: string;
  title: string;
  body: string;
  windowMinutes: number;
  windowStart: Date;
  windowEnd: Date;
  messageCount: number;
  imageCount: number;
}

const COLUMNS =
  'id, contact_number, title, body, window_minutes, window_start, window_end, message_count, image_count, created_at';

/** Owns all `summaries` SQL. AI summaries are user-triggered per thread. */
class SummaryService {
  /** Newest-first summaries for one thread (contact number or group id). */
  async list(rawNumber: string, limit = 50): Promise<SummaryEntry[]> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<SummaryEntry>(
      `SELECT ${COLUMNS} FROM summaries
        WHERE contact_number = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [number, limit],
    );
    return rows;
  }

  async get(id: string | number): Promise<SummaryEntry | null> {
    const { rows } = await query<SummaryEntry>(`SELECT ${COLUMNS} FROM summaries WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async create(input: CreateSummaryInput): Promise<SummaryEntry> {
    const { rows } = await query<SummaryEntry>(
      `INSERT INTO summaries
         (contact_number, title, body, window_minutes, window_start, window_end, message_count, image_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${COLUMNS}`,
      [
        normalizeNumber(input.contactNumber),
        input.title,
        input.body,
        input.windowMinutes,
        input.windowStart,
        input.windowEnd,
        input.messageCount,
        input.imageCount,
      ],
    );
    return rows[0];
  }
}

export const summaryService = new SummaryService();
