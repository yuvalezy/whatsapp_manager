import { query } from '../db';
import { normalizeNumber } from '../utils/phone';
import { isAudioType } from '../media/media.service';
import { logger } from '../logger';
import { whitelistService, PreferredLanguage } from '../whitelist/whitelist.service';
import {
  PendingTranscription,
  RoutableMessage,
  StoredMessage,
  TranscriptionStatus,
  TranslationStatus,
} from './message.model';

const LANGUAGE_VOTES: readonly PreferredLanguage[] = ['es', 'en', 'he'];

const SELECT_COLS = `
  id, message_id, chat_id, contact_number, sender_number, sender_name,
  body, message_type, direction, timestamp, created_at,
  detected_language,
  media_type, media_path, media_mimetype, media_filesize, media_status,
  transcript, transcript_language, transcript_translated, transcription_status,
  translated_body, translation_status
`;

class MessageService {
  /** Persist a message (idempotent on message_id). Returns true if newly inserted. */
  async save(msg: RoutableMessage): Promise<boolean> {
    const media = msg.media;
    // Queue audio for transcription only once its file is actually on disk.
    const transcriptionStatus: TranscriptionStatus =
      media && media.status === 'downloaded' && isAudioType(media.mediaType) ? 'pending' : 'none';

    const { rowCount } = await query(
      `INSERT INTO messages
         (message_id, chat_id, contact_number, sender_number, sender_name, body,
          message_type, direction, timestamp, metadata, detected_language,
          media_type, media_path, media_mimetype, media_filesize, media_status,
          transcription_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (message_id) DO NOTHING`,
      [
        msg.messageId,
        msg.chatId,
        msg.contactNumber ?? msg.senderNumber,
        msg.senderNumber,
        msg.senderName ?? null,
        msg.body,
        msg.messageType,
        msg.direction,
        msg.timestamp,
        msg.metadata ? JSON.stringify(msg.metadata) : null,
        msg.detectedLanguage ?? null,
        media?.mediaType ?? null,
        media?.path ?? null,
        media?.mimetype ?? null,
        media?.filesize ?? null,
        media?.status ?? 'none',
        transcriptionStatus,
      ],
    );
    const inserted = (rowCount ?? 0) > 0;

    // Feed the free per-message language hint into the contact's running
    // preferred-language vote. Best-effort — must never break persistence,
    // which has already succeeded by this point.
    if (
      inserted &&
      msg.direction === 'inbound' &&
      (LANGUAGE_VOTES as readonly string[]).includes(msg.detectedLanguage ?? '')
    ) {
      try {
        await whitelistService.recordInboundLanguage(
          msg.contactNumber ?? msg.senderNumber,
          msg.detectedLanguage as PreferredLanguage,
        );
      } catch (err) {
        logger.error({ err, contactNumber: msg.contactNumber }, 'Failed to record inbound language vote');
      }
    }

    return inserted;
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

  /** Full thread for a contact — both inbound and outbound, keyed by contact_number. */
  async listByNumber(rawNumber: string, limit = 100, offset = 0): Promise<StoredMessage[]> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        WHERE contact_number = $1
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3`,
      [number, limit, offset],
    );
    return rows;
  }

  async getById(id: string | number): Promise<StoredMessage | null> {
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** Epoch ms of the most recent stored message for a contact, or null if none captured yet. */
  async getLastMessageTimestamp(rawNumber: string): Promise<number | null> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<{ max: Date | null }>(
      `SELECT MAX(timestamp) AS max FROM messages WHERE contact_number = $1`,
      [number],
    );
    const max = rows[0]?.max;
    return max ? new Date(max).getTime() : null;
  }

  /** One row per contact — each contact's most recent message, for a conversation list. */
  async listThreads(): Promise<StoredMessage[]> {
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM (
         SELECT DISTINCT ON (contact_number) *
         FROM messages
         WHERE contact_number IS NOT NULL
         ORDER BY contact_number, timestamp DESC
       ) t
       ORDER BY timestamp DESC`,
    );
    return rows;
  }

  /** A contact's messages that still have content to translate and aren't done yet. */
  async listUntranslated(rawNumber: string): Promise<StoredMessage[]> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        WHERE contact_number = $1
          AND translation_status != 'done'
          AND (NULLIF(TRIM(COALESCE(body, '')), '') IS NOT NULL
               OR NULLIF(TRIM(COALESCE(transcript, '')), '') IS NOT NULL)
        ORDER BY timestamp ASC`,
      [number],
    );
    return rows;
  }

  /** Rows awaiting transcription (audio with a downloaded file). */
  async listPendingTranscription(limit = 5): Promise<PendingTranscription[]> {
    const { rows } = await query<PendingTranscription>(
      `SELECT id, media_path, media_mimetype, media_type
         FROM messages
        WHERE transcription_status = 'pending' AND media_path IS NOT NULL
        ORDER BY id ASC
        LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async setTranscription(
    id: string | number,
    data: { transcript: string | null; language: string | null; status: TranscriptionStatus },
  ): Promise<void> {
    await query(
      `UPDATE messages
          SET transcript = $2, transcript_language = $3, transcription_status = $4
        WHERE id = $1`,
      [id, data.transcript, data.language, data.status],
    );
  }

  async setTranslation(
    id: string | number,
    data: {
      translatedBody: string | null;
      transcriptTranslated: string | null;
      detectedLanguage: string | null;
      status: TranslationStatus;
    },
  ): Promise<void> {
    await query(
      `UPDATE messages
          SET translated_body = $2,
              transcript_translated = $3,
              detected_language = COALESCE($4, detected_language),
              translation_status = $5
        WHERE id = $1`,
      [id, data.translatedBody, data.transcriptTranslated, data.detectedLanguage, data.status],
    );
  }

  /** Update only the translation status (used to mark failures without touching content). */
  async setTranslationStatus(id: string | number, status: TranslationStatus): Promise<void> {
    await query('UPDATE messages SET translation_status = $2 WHERE id = $1', [id, status]);
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
