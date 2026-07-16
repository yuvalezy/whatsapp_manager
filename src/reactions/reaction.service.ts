import { query } from '../db';
import { logger } from '../logger';
import { messageService } from '../messages/message.service';
import { normalizeNumber } from '../utils/phone';

/** Postgres foreign-key-violation SQLSTATE. */
const FK_VIOLATION = '23503';

export interface ReactionInput {
  /** Serialized WhatsApp id of the message being reacted to. */
  messageId: string;
  /** Reactor's number (will be normalized to digits). */
  senderNumber: string;
  /** Emoji. An empty string means the reaction was removed. */
  reaction: string;
  /** When the reaction was created/changed. */
  timestamp: Date;
}

/**
 * Owns the `message_reactions` table.
 *
 * PRIVACY: a reaction is only ever recorded for a message we already store. The
 * FK to messages(message_id) rejects any reaction whose target isn't stored —
 * exactly the set of ignored / non-whitelisted / non-monitored-group messages —
 * and that FK violation is caught and dropped here. So the privacy invariant
 * (never persist anything about ignored chats) holds at the DB level without a
 * second policy check on the WhatsApp layer.
 *
 * A reaction is current-state per (message, sender): re-reacting UPSERTs and a
 * removal (empty reaction) deletes the row. Mirrors the singleton + owns-its-SQL
 * pattern of whitelistService / groupService.
 */
class ReactionService {
  /** Record (or update, or on empty reaction remove) a reaction. No-op for unstored targets. */
  async record(input: ReactionInput): Promise<void> {
    const senderNumber = normalizeNumber(input.senderNumber);
    if (!input.messageId || !senderNumber) return;

    // WhatsApp sends an empty reactionText when a reaction is cleared. A DELETE
    // touches no other table and simply affects 0 rows for unstored targets, so
    // it needs no FK guard.
    if (!input.reaction) {
      const { rowCount } = await query(
        `DELETE FROM message_reactions WHERE message_id = $1 AND sender_number = $2`,
        [input.messageId, senderNumber],
      );
      // Live-update open threads (reactions are aggregated into message reads).
      if ((rowCount ?? 0) > 0) await messageService.broadcastUpdated(input.messageId);
      return;
    }

    try {
      await query(
        `INSERT INTO message_reactions (message_id, sender_number, reaction, timestamp)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id, sender_number)
         DO UPDATE SET reaction = EXCLUDED.reaction, timestamp = EXCLUDED.timestamp`,
        [input.messageId, senderNumber, input.reaction, input.timestamp],
      );
      await messageService.broadcastUpdated(input.messageId);
    } catch (err) {
      // FK violation ⇒ the target message isn't stored (ignored chat). Drop it
      // to preserve the privacy invariant. Log ids only, never content.
      if ((err as { code?: string }).code === FK_VIOLATION) {
        logger.debug({ messageId: input.messageId }, 'Dropped reaction for unstored message');
        return;
      }
      throw err;
    }
  }
}

export const reactionService = new ReactionService();
