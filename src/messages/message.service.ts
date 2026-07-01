import { query } from '../db';
import { normalizeNumber } from '../utils/phone';
import { RoutableMessage, StoredMessage } from './message.model';

const SELECT_COLS = `
  id, message_id, chat_id, sender_number, sender_name,
  body, message_type, direction, timestamp, created_at
`;

class MessageService {
  /** Persist a message (idempotent on message_id). Returns true if newly inserted. */
  async save(msg: RoutableMessage): Promise<boolean> {
    const { rowCount } = await query(
      `INSERT INTO messages
         (message_id, chat_id, sender_number, sender_name, body,
          message_type, direction, timestamp, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (message_id) DO NOTHING`,
      [
        msg.messageId,
        msg.chatId,
        msg.senderNumber,
        msg.senderName ?? null,
        msg.body,
        msg.messageType,
        msg.direction,
        msg.timestamp,
        msg.metadata ? JSON.stringify(msg.metadata) : null,
      ],
    );
    return (rowCount ?? 0) > 0;
  }

  async list(limit = 100, offset = 0): Promise<StoredMessage[]> {
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        ORDER BY timestamp DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  async listByNumber(rawNumber: string, limit = 100, offset = 0): Promise<StoredMessage[]> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        WHERE sender_number = $1
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3`,
      [number, limit, offset],
    );
    return rows;
  }

  /** Persist an aggregated ignored-message counter delta (no content). */
  async addIgnored(reason: string, delta: number): Promise<void> {
    await query(
      `INSERT INTO ignored_stats (bucket_date, reason, count)
       VALUES (CURRENT_DATE, $1, $2)
       ON CONFLICT (bucket_date, reason)
       DO UPDATE SET count = ignored_stats.count + EXCLUDED.count`,
      [reason, delta],
    );
  }
}

export const messageService = new MessageService();
