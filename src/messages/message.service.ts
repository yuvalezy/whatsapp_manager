import { query } from '../db';
import { normalizeNumber } from '../utils/phone';
import { isAudioType } from '../media/media.service';
import { logger } from '../logger';
import { whitelistService, PreferredLanguage } from '../whitelist/whitelist.service';
import { sseManager } from '../sse';
import {
  MessageDirection,
  PendingTranscription,
  RoutableMessage,
  StoredMessage,
  TranscriptionStatus,
  TranslationStatus,
} from './message.model';

const LANGUAGE_VOTES: readonly PreferredLanguage[] = ['es', 'en', 'he'];

const SELECT_COLS = `
  id, message_id, chat_id, contact_number, sender_number, sender_name,
  body, message_type, direction, timestamp, created_at, updated_at,
  detected_language,
  media_type, media_path, media_mimetype, media_filesize, media_status,
  transcript, transcript_language, transcript_translated, transcription_status,
  translated_body, translation_status,
  ack, reply_to_message_id, edited_at, is_deleted, deleted_at
`;

/** Optional filters for the incremental-sync message list. All optional. */
export interface ListMessagesOptions {
  limit?: number;
  offset?: number;
  /** ISO timestamp — only rows changed after this (updated_at >). For incremental pulls. */
  updatedSince?: string;
  direction?: MessageDirection;
  /** WhatsApp message_type (chat | image | ptt | audio | video | document | sticker | …). */
  type?: string;
  contactNumber?: string;
  /** true → only messages with an attachment; false → only text; undefined → both. */
  hasMedia?: boolean;
}

/** Options for full-text search. */
export interface SearchMessagesOptions {
  limit?: number;
  offset?: number;
  direction?: MessageDirection;
  type?: string;
  contactNumber?: string;
}

/** Read-only aggregate stats for the dashboard / stats page. */
export interface MessageStats {
  totalMessages: number;
  inbound: number;
  outbound: number;
  withMedia: number;
  transcribed: number;
  translated: number;
  /** Last 30 calendar days, ascending, zero-filled (every day present). */
  perDay: { date: string; inbound: number; outbound: number }[];
  /** Top 10 threads by message count (contact_number non-null). */
  topContacts: { contact_number: string; count: number }[];
}

/** Narrow row projection streamed by the export endpoint (json/csv). */
export interface ExportRow {
  id: string;
  message_id: string;
  contact_number: string | null;
  sender_number: string;
  sender_name: string | null;
  direction: MessageDirection;
  message_type: string;
  body: string | null;
  transcript: string | null;
  translated_body: string | null;
  timestamp: string;
  is_deleted: boolean;
}

function clampLimit(limit: number | undefined, fallback: number): number {
  return Math.min(Math.max(Math.trunc(limit ?? fallback) || fallback, 1), 500);
}

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
          transcription_status, ack, reply_to_message_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
        msg.ack ?? null,
        msg.replyToMessageId ?? null,
      ],
    );
    const inserted = (rowCount ?? 0) > 0;

    // Push the newly inserted message to all SSE clients so the frontend
    // updates in real time without polling.
    if (inserted) {
      try {
        const { rows: full } = await query<StoredMessage>(
          `SELECT ${SELECT_COLS} FROM messages WHERE message_id = $1`,
          [msg.messageId],
        );
        if (full[0]) {
          sseManager.broadcast('message', full[0]);
        }
      } catch {
        /* SSE is best-effort — never break persistence */
      }
    }

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

  /**
   * Global message feed with optional filters, newest first. Returns the page
   * plus the total matching count (for paging + incremental sync). All filters
   * are optional and backward compatible; `updatedSince` (ISO) drives the
   * external agent's incremental pull via the auto-stamped `updated_at`.
   */
  async list(opts: ListMessagesOptions = {}): Promise<{ rows: StoredMessage[]; total: number }> {
    const limit = clampLimit(opts.limit, 100);
    const offset = Math.max(Math.trunc(opts.offset ?? 0) || 0, 0);

    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.updatedSince) {
      params.push(new Date(opts.updatedSince));
      where.push(`updated_at > $${params.length}`);
    }
    if (opts.direction) {
      params.push(opts.direction);
      where.push(`direction = $${params.length}`);
    }
    if (opts.type) {
      params.push(opts.type);
      where.push(`message_type = $${params.length}`);
    }
    if (opts.contactNumber) {
      params.push(normalizeNumber(opts.contactNumber));
      where.push(`contact_number = $${params.length}`);
    }
    if (opts.hasMedia != null) {
      where.push(opts.hasMedia ? 'media_type IS NOT NULL' : 'media_type IS NULL');
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows: countRows } = await query<{ total: string }>(
      `SELECT count(*)::bigint AS total FROM messages ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        ${whereSql}
        ORDER BY timestamp DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    return { rows, total };
  }

  /** Total number of stored messages (lightweight KPI). */
  async total(): Promise<number> {
    const { rows } = await query<{ total: string }>('SELECT count(*)::bigint AS total FROM messages');
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Full-text search across body + transcript + translated_body (the STORED
   * `search_tsv` generated column, `'simple'` config). Ranked by relevance then
   * recency. Optional direction/type/contact filters. Returns the page + total.
   */
  async searchMessages(
    q: string,
    opts: SearchMessagesOptions = {},
  ): Promise<{ rows: StoredMessage[]; total: number }> {
    const limit = clampLimit(opts.limit, 50);
    const offset = Math.max(Math.trunc(opts.offset ?? 0) || 0, 0);

    // $1 is always the raw query string, fed to websearch_to_tsquery once via
    // a cross join so both filter and ranking reuse the parsed tsquery.
    const where: string[] = ['m.search_tsv @@ tsq.query'];
    const params: unknown[] = [q];
    if (opts.direction) {
      params.push(opts.direction);
      where.push(`m.direction = $${params.length}`);
    }
    if (opts.type) {
      params.push(opts.type);
      where.push(`m.message_type = $${params.length}`);
    }
    if (opts.contactNumber) {
      params.push(normalizeNumber(opts.contactNumber));
      where.push(`m.contact_number = $${params.length}`);
    }
    const whereSql = where.join(' AND ');
    const fromSql = `FROM messages m, websearch_to_tsquery('simple', $1) AS tsq(query)`;

    const { rows: countRows } = await query<{ total: string }>(
      `SELECT count(*)::bigint AS total ${fromSql} WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} ${fromSql}
        WHERE ${whereSql}
        ORDER BY ts_rank(m.search_tsv, tsq.query) DESC, m.timestamp DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    return { rows, total };
  }

  /**
   * Read-only aggregate stats for the dashboard / stats page. Three grouped
   * queries run in parallel (no N+1): overall totals, a 30-day inbound/outbound
   * timeseries (zero-filled via generate_series so every day is present), and
   * the top 10 threads by message count. Reads only the `messages` table, so it
   * is inherently free of ignored-chat content.
   */
  async getStats(): Promise<MessageStats> {
    const [totalsRes, perDayRes, topRes] = await Promise.all([
      query<{
        total: string;
        inbound: string;
        outbound: string;
        with_media: string;
        transcribed: string;
        translated: string;
      }>(
        `SELECT
           count(*)::bigint AS total,
           count(*) FILTER (WHERE direction = 'inbound')::bigint AS inbound,
           count(*) FILTER (WHERE direction = 'outbound')::bigint AS outbound,
           count(*) FILTER (WHERE media_type IS NOT NULL)::bigint AS with_media,
           count(*) FILTER (WHERE transcription_status = 'done')::bigint AS transcribed,
           count(*) FILTER (WHERE translation_status = 'done')::bigint AS translated
         FROM messages`,
      ),
      query<{ date: string; inbound: number; outbound: number }>(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
                count(*) FILTER (WHERE m.direction = 'inbound')::int AS inbound,
                count(*) FILTER (WHERE m.direction = 'outbound')::int AS outbound
           FROM generate_series(
                  date_trunc('day', now()) - interval '29 days',
                  date_trunc('day', now()),
                  interval '1 day'
                ) AS d(day)
           LEFT JOIN messages m ON date_trunc('day', m.timestamp) = d.day
          GROUP BY d.day
          ORDER BY d.day ASC`,
      ),
      query<{ contact_number: string; count: number }>(
        `SELECT contact_number, count(*)::int AS count
           FROM messages
          WHERE contact_number IS NOT NULL
          GROUP BY contact_number
          ORDER BY count DESC, contact_number ASC
          LIMIT 10`,
      ),
    ]);

    const t = totalsRes.rows[0];
    return {
      totalMessages: Number(t?.total ?? 0),
      inbound: Number(t?.inbound ?? 0),
      outbound: Number(t?.outbound ?? 0),
      withMedia: Number(t?.with_media ?? 0),
      transcribed: Number(t?.transcribed ?? 0),
      translated: Number(t?.translated ?? 0),
      perDay: perDayRes.rows,
      topContacts: topRes.rows,
    };
  }

  /**
   * Stream export rows in ascending-`id` batches (keyset pagination) so memory
   * stays bounded regardless of thread size — true streaming, no row cap, no new
   * deps. `rawNumber` (a contact/group thread key) is normalized the same way as
   * `listByNumber`; omit it to export every stored message. Only the `messages`
   * table is read, so ignored-chat content can never leak.
   */
  async *streamForExport(rawNumber?: string, batchSize = 1000): AsyncGenerator<ExportRow> {
    const number = rawNumber ? normalizeNumber(rawNumber) : null;
    let lastId = '0';
    for (;;) {
      const params: unknown[] = [lastId];
      let where = 'id > $1::bigint';
      if (number) {
        params.push(number);
        where += ` AND contact_number = $${params.length}`;
      }
      params.push(batchSize);
      const { rows } = await query<ExportRow>(
        `SELECT id, message_id, contact_number, sender_number, sender_name,
                direction, message_type, body, transcript, translated_body,
                timestamp, is_deleted
           FROM messages
          WHERE ${where}
          ORDER BY id ASC
          LIMIT $${params.length}`,
        params,
      );
      if (rows.length === 0) break;
      for (const row of rows) yield row;
      lastId = rows[rows.length - 1].id;
      if (rows.length < batchSize) break;
    }
  }

  /**
   * Full thread for a contact — both inbound and outbound, keyed by contact_number.
   * `id DESC` is a deterministic tie-break on equal timestamps so the newest-page
   * boundary lines up with `listByNumberBefore`'s keyset cursor (no split ties →
   * no skipped row when "load older" pages back from here).
   */
  async listByNumber(rawNumber: string, limit = 100, offset = 0): Promise<StoredMessage[]> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        WHERE contact_number = $1
        ORDER BY timestamp DESC, id DESC
        LIMIT $2 OFFSET $3`,
      [number, limit, offset],
    );
    return rows;
  }

  /**
   * Keyset "load older" page: the thread's messages strictly older than a cursor
   * (timestamp, tie-broken by id), newest-first, capped at `limit`. Unlike offset
   * paging this can't skip or duplicate a row when a live message lands mid-scroll,
   * because the cursor is a stable position in the thread, not a running count.
   */
  async listByNumberBefore(
    rawNumber: string,
    beforeTimestamp: string,
    beforeId: string,
    limit = 100,
  ): Promise<StoredMessage[]> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        WHERE contact_number = $1
          AND (timestamp < $2 OR (timestamp = $2 AND id < $3::bigint))
        ORDER BY timestamp DESC, id DESC
        LIMIT $4`,
      [number, new Date(beforeTimestamp), beforeId, clampLimit(limit, 100)],
    );
    return rows;
  }

  /** A thread's messages within a time window [startMs, endMs], oldest first (for summarization). */
  async listByNumberBetween(rawNumber: string, startMs: number, endMs: number): Promise<StoredMessage[]> {
    const number = normalizeNumber(rawNumber);
    const { rows } = await query<StoredMessage>(
      `SELECT ${SELECT_COLS} FROM messages
        WHERE contact_number = $1
          AND timestamp >= $2
          AND timestamp <= $3
        ORDER BY timestamp ASC`,
      [number, new Date(startMs), new Date(endMs)],
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

  /**
   * Count unseen inbound messages per thread, given each thread's read watermark
   * (null = never read → all inbound counts). Keyed by `contact_number`, which is
   * the thread id for both 1:1 contacts and groups. Reads only the `messages`
   * table — the cutoffs are passed in, so no cross-table read here.
   */
  async getUnreadCounts(
    reads: { threadId: string; lastReadAt: string | null }[],
  ): Promise<Map<string, number>> {
    if (reads.length === 0) return new Map();
    const ids = reads.map((r) => r.threadId);
    const cutoffs = reads.map((r) => r.lastReadAt);
    const { rows } = await query<{ contact_number: string; unread: number }>(
      `SELECT m.contact_number, COUNT(*)::int AS unread
         FROM messages m
         JOIN unnest($1::text[], $2::timestamptz[]) AS r(tid, last_read)
           ON m.contact_number = r.tid
        WHERE m.direction = 'inbound'
          AND (r.last_read IS NULL OR m.timestamp > r.last_read)
        GROUP BY m.contact_number`,
      [ids, cutoffs],
    );
    return new Map(rows.map((r) => [r.contact_number, r.unread]));
  }

  /**
   * Update an outbound message's WhatsApp delivery ack (from the `message_ack`
   * event) and push the change to SSE clients. No-ops for messages we don't
   * store (0 rows updated → no broadcast).
   */
  async updateAck(messageId: string, ack: number): Promise<void> {
    const { rows } = await query<{ contact_number: string | null }>(
      `UPDATE messages SET ack = $2
        WHERE message_id = $1 AND direction = 'outbound'
        RETURNING contact_number`,
      [messageId, ack],
    );
    if (rows[0]) {
      try {
        sseManager.broadcast('ack', {
          message_id: messageId,
          contact_number: rows[0].contact_number,
          ack,
        });
      } catch {
        /* SSE is best-effort */
      }
    }
  }

  /**
   * Soft-delete a captured message (sender revoked / "delete for everyone").
   * No-op if we never stored it (0 rows). Content is retained; only the flag +
   * timestamp are set. `updated_at` is auto-stamped by the trigger.
   */
  async markDeleted(messageId: string, deletedAt: Date, chatId?: string): Promise<void> {
    // Chat-affinity guard: whatsapp-web.js recovers the revoked id from a single
    // GLOBAL `last_message`, so in an app watching many chats a revoke in chat A
    // can hand us an id belonging to chat B. Scoping the UPDATE to the revoke
    // event's own chat means a cross-chat mismatch simply affects 0 rows.
    const { rowCount } = chatId
      ? await query(
          `UPDATE messages SET is_deleted = true, deleted_at = $2 WHERE message_id = $1 AND chat_id = $3`,
          [messageId, deletedAt, chatId],
        )
      : await query(
          `UPDATE messages SET is_deleted = true, deleted_at = $2 WHERE message_id = $1`,
          [messageId, deletedAt],
        );
    if ((rowCount ?? 0) > 0) await this.broadcastUpdated(messageId);
  }

  /**
   * Update a captured message's body in place (WhatsApp "edit message"),
   * stamping `edited_at`. No-op if we never stored it (0 rows). The
   * `search_tsv` generated column re-derives automatically.
   */
  async updateBody(messageId: string, newBody: string, editedAt: Date): Promise<void> {
    const { rowCount } = await query(
      `UPDATE messages SET body = $2, edited_at = $3 WHERE message_id = $1`,
      [messageId, newBody, editedAt],
    );
    if ((rowCount ?? 0) > 0) await this.broadcastUpdated(messageId);
  }

  /** Push the current state of a mutated message to SSE clients (best-effort). */
  private async broadcastUpdated(messageId: string): Promise<void> {
    try {
      const { rows } = await query<StoredMessage>(
        `SELECT ${SELECT_COLS} FROM messages WHERE message_id = $1`,
        [messageId],
      );
      if (rows[0]) sseManager.broadcast('message-updated', rows[0]);
    } catch {
      /* SSE is best-effort — never break the mutation */
    }
  }

  /**
   * Same as `broadcastUpdated` but keyed by the internal numeric `id` — used by
   * the enrichment setters (transcription), which is the ONE mutation path with
   * no HTTP round-trip back to the frontend, so SSE is its only way to flip an
   * open thread's "Transcribing…" pill to the finished transcript.
   */
  private async broadcastUpdatedById(id: string | number): Promise<void> {
    try {
      const { rows } = await query<StoredMessage>(
        `SELECT ${SELECT_COLS} FROM messages WHERE id = $1`,
        [id],
      );
      if (rows[0]) sseManager.broadcast('message-updated', rows[0]);
    } catch {
      /* SSE is best-effort — never break the mutation */
    }
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

  /**
   * Atomically claim a batch of audio rows for transcription. Flips each from
   * 'pending' (or stale 'processing') to 'processing' and bumps
   * `transcription_attempts`, all in one statement under `FOR UPDATE SKIP
   * LOCKED`, so an overlapping poll tick can't re-grab an in-flight row and
   * double-bill the OpenAI call. Stale 'processing' rows (updated_at older than
   * 10 min — a crash mid-transcription) are reclaimed so nothing gets stuck.
   */
  async claimPendingTranscriptions(limit = 5, maxAttempts = 3): Promise<PendingTranscription[]> {
    const { rows } = await query<PendingTranscription>(
      `UPDATE messages
          SET transcription_status = 'processing',
              transcription_attempts = transcription_attempts + 1
        WHERE id IN (
          SELECT id FROM messages
           WHERE media_path IS NOT NULL
             AND transcription_attempts < $2
             AND (
               transcription_status = 'pending'
               OR (transcription_status = 'processing'
                   AND updated_at < now() - interval '10 minutes')
             )
           ORDER BY id ASC
           FOR UPDATE SKIP LOCKED
           LIMIT $1
        )
        RETURNING id, media_path, media_mimetype, media_type`,
      [limit, maxAttempts],
    );
    return rows;
  }

  /**
   * Flip stale 'processing' rows that have exhausted their attempt budget to
   * 'failed'. Guards the poison-pill case: if a file reliably CRASHES the
   * process mid-transcription (OOM/corrupt audio), the row never reaches
   * `markTranscriptionFailed`, so without this it would be reclaimed and
   * re-billed to OpenAI every 10 min forever. Run once per poll tick.
   */
  async failStuckTranscriptions(maxAttempts: number): Promise<number> {
    const { rowCount } = await query(
      `UPDATE messages
          SET transcription_status = 'failed'
        WHERE transcription_status = 'processing'
          AND transcription_attempts >= $1
          AND updated_at < now() - interval '10 minutes'`,
      [maxAttempts],
    );
    return rowCount ?? 0;
  }

  /**
   * Record a transcription failure: keep the row retryable ('pending') until
   * it has been attempted `maxAttempts` times, then mark it permanently
   * 'failed'. `transcription_attempts` was already incremented at claim time.
   */
  async markTranscriptionFailed(id: string | number, maxAttempts: number): Promise<void> {
    await query(
      `UPDATE messages
          SET transcription_status =
                CASE WHEN transcription_attempts >= $2 THEN 'failed' ELSE 'pending' END
        WHERE id = $1`,
      [id, maxAttempts],
    );
    await this.broadcastUpdatedById(id);
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
    // Background worker path — SSE is the only channel back to an open thread.
    await this.broadcastUpdatedById(id);
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
