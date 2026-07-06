import { Router } from 'express';
import fs from 'node:fs';
import { messageService, ExportRow } from './message.service';
import { StoredMessage } from './message.model';
import { translationService } from '../enrichment/translation.service';
import { draftReplyService } from '../enrichment/draft-reply.service';
import { absoluteMediaPath } from '../media/media.service';
import { whitelistService } from '../whitelist/whitelist.service';
import { groupService } from '../groups/group.service';
import { readStateService } from '../reads/read-state.service';
import { costService } from '../costs/cost.service';
import { whatsappService } from '../whatsapp/client';
import { normalizeNumber, toChatId, toGroupChatId } from '../utils/phone';
import { env } from '../config/env';
import { summaryService } from '../summaries/summary.service';
import { summarizationService } from '../enrichment/summarization.service';
import { logger } from '../logger';

export const messagesRouter = Router();

function parsePaging(query: Record<string, unknown>): { limit: number; offset: number } {
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

function parseDirection(v: unknown): 'inbound' | 'outbound' | undefined {
  return v === 'inbound' || v === 'outbound' ? v : undefined;
}

function parseStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

// Export column order — the CSV header and each CSV/NDJSON row derive from this
// one list so they can never drift apart.
const EXPORT_COLUMNS: (keyof ExportRow)[] = [
  'id', 'message_id', 'contact_number', 'sender_number', 'sender_name',
  'direction', 'message_type', 'body', 'transcript', 'translated_body',
  'timestamp', 'is_deleted',
];
const EXPORT_CSV_HEADER = EXPORT_COLUMNS.join(',');

/** RFC-4180 CSV cell: quote when it contains a comma, quote, or newline. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvLine(row: ExportRow): string {
  return EXPORT_COLUMNS.map((c) => csvCell(row[c])).join(',');
}

// GET /messages?limit=&offset=&updated_since=&direction=&type=&contactNumber=&hasMedia=
// Global feed with optional filters; `updated_since` (ISO) drives incremental sync.
messagesRouter.get('/', async (req, res, next) => {
  try {
    const q = req.query as Record<string, unknown>;
    const { limit, offset } = parsePaging(q);
    const { rows, total } = await messageService.list({
      limit,
      offset,
      updatedSince: parseStr(q.updated_since),
      direction: parseDirection(q.direction),
      type: parseStr(q.type),
      contactNumber: parseStr(q.contactNumber),
      hasMedia: parseBool(q.hasMedia),
    });
    res.json({ data: rows, paging: { limit, offset, total } });
  } catch (err) {
    next(err);
  }
});

// GET /messages/count — lightweight total-messages KPI for the dashboard.
messagesRouter.get('/count', async (_req, res, next) => {
  try {
    res.json({ data: { total: await messageService.total() } });
  } catch (err) {
    next(err);
  }
});

// GET /messages/search?q=&limit=&offset=&direction=&type=&contactNumber=
// Full-text search across body + transcript + translated_body.
messagesRouter.get('/search', async (req, res, next) => {
  try {
    const q = req.query as Record<string, unknown>;
    const term = parseStr(q.q);
    const { limit, offset } = parsePaging(q);
    if (!term) {
      res.json({ data: [], paging: { limit, offset, total: 0 } });
      return;
    }
    const { rows, total } = await messageService.searchMessages(term, {
      limit,
      offset,
      direction: parseDirection(q.direction),
      type: parseStr(q.type),
      contactNumber: parseStr(q.contactNumber),
    });
    res.json({ data: rows, paging: { limit, offset, total } });
  } catch (err) {
    next(err);
  }
});

// GET /messages/stats — read-only aggregate KPIs + a 30-day timeseries + top
// contacts, for the dashboard/stats page. All SQL lives in message.service.
messagesRouter.get('/stats', async (_req, res, next) => {
  try {
    res.json({ data: await messageService.getStats() });
  } catch (err) {
    next(err);
  }
});

// GET /messages/export?number=&format=json|csv — stream a thread (or every
// stored message when `number` is omitted) as NDJSON (default) or CSV. Rows are
// streamed in id-ascending batches, so memory stays bounded regardless of size.
messagesRouter.get('/export', async (req, res, next) => {
  const q = req.query as Record<string, unknown>;
  const number = parseStr(q.number);
  const format = q.format === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = (number ?? 'all').replace(/[^A-Za-z0-9._-]/g, '_');
  try {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="messages-${safe}-${stamp}.csv"`);
      res.write(EXPORT_CSV_HEADER + '\n');
      for await (const row of messageService.streamForExport(number)) {
        res.write(toCsvLine(row) + '\n');
      }
    } else {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', `attachment; filename="messages-${safe}-${stamp}.ndjson"`);
      for await (const row of messageService.streamForExport(number)) {
        res.write(JSON.stringify(row) + '\n');
      }
    }
    res.end();
  } catch (err) {
    // Once streaming has begun the headers are already flushed, so we can't send
    // a JSON error envelope — just log and close the connection.
    if (res.headersSent) {
      logger.error({ err, number }, 'Export stream failed after headers sent');
      res.end();
    } else {
      next(err);
    }
  }
});

/**
 * Best-effort live WhatsApp mute lookup for every thread, keyed by the same
 * normalized ids used elsewhere (phone number for contacts, group id for
 * groups). One batched `getChats()` call, mirroring the GET /contacts and
 * GET /groups/available pattern. Never fails the /threads request — falls
 * back to "nothing muted" if the client isn't ready or the lookup errors.
 */
async function getMutedThreadIds(): Promise<Set<string>> {
  const client = whatsappService.getClient();
  if (!client || whatsappService.getState() !== 'READY') return new Set();
  try {
    const mutedChats = (await client.getChats()).filter((c) => c.isMuted);
    // Only resolve LIDs we actually need (muted 1:1 chats), same as GET /contacts.
    const lidIds = mutedChats
      .filter((c) => !c.isGroup && c.id.server === 'lid')
      .map((c) => c.id._serialized);
    const resolved = lidIds.length > 0 ? await client.getContactLidAndPhone(lidIds) : [];
    const lidToPhone = new Map(resolved.map((r) => [r.lid, normalizeNumber(r.pn)]));

    const muted = new Set<string>();
    for (const c of mutedChats) {
      const id = c.isGroup
        ? normalizeNumber(c.id._serialized)
        : c.id.server === 'lid'
          ? (lidToPhone.get(c.id._serialized) ?? normalizeNumber(c.id.user))
          : normalizeNumber(c.id.user);
      if (id) muted.add(id);
    }
    return muted;
  } catch (err) {
    logger.error({ err }, 'Failed to fetch WhatsApp mute state for threads');
    return new Set();
  }
}

// GET /messages/threads — one row per monitored conversation (whitelisted
// contacts + monitored groups), each with its latest message, sorted by
// recency, for the Conversations inbox view. `id` is the thread key
// (phone_number for contacts, group_id for groups) and is what GET
// /messages/:number expects.
messagesRouter.get('/threads', async (_req, res, next) => {
  try {
    const [contacts, groups, latest, reads, mutedIds] = await Promise.all([
      whitelistService.list(),
      groupService.list(),
      messageService.listThreads(),
      readStateService.list(),
      getMutedThreadIds(),
    ]);
    const byNumber = new Map(latest.map((m) => [m.contact_number, m]));
    const readAt = new Map(reads.map((r) => [r.thread_id, r.last_read_at]));

    const ids = [...contacts.map((c) => c.phone_number), ...groups.map((g) => g.group_id)];
    const unread = await messageService.getUnreadCounts(
      ids.map((id) => ({ threadId: id, lastReadAt: readAt.get(id) ?? null })),
    );

    const contactThreads = contacts.map((c) => ({
      type: 'contact' as const,
      id: c.phone_number,
      label: c.label,
      bp: c.ezy_bp_name ?? null,
      lastMessage: byNumber.get(c.phone_number) ?? null,
      unread: unread.get(c.phone_number) ?? 0,
      muted: mutedIds.has(c.phone_number),
    }));
    const groupThreads = groups.map((g) => ({
      type: 'group' as const,
      id: g.group_id,
      label: g.subject,
      bp: g.ezy_bp_name ?? null,
      lastMessage: byNumber.get(g.group_id) ?? null,
      unread: unread.get(g.group_id) ?? 0,
      muted: mutedIds.has(g.group_id),
    }));

    const threads = [...contactThreads, ...groupThreads].sort((a, b) => {
      const at = a.lastMessage?.timestamp;
      const bt = b.lastMessage?.timestamp;
      if (at && bt) return new Date(bt).getTime() - new Date(at).getTime();
      if (at) return -1;
      if (bt) return 1;
      return (a.label ?? a.id).localeCompare(b.label ?? b.id);
    });
    res.json({ data: threads });
  } catch (err) {
    next(err);
  }
});

/** Translates one message's body/transcript in place via DeepSeek. Throws on failure. */
async function translateMessageRow(msg: StoredMessage): Promise<'translated' | 'skipped'> {
  const hasBody = !!msg.body && msg.body.trim() !== '';
  const hasTranscript = !!msg.transcript && msg.transcript.trim() !== '';
  if (!hasBody && !hasTranscript) {
    await messageService.setTranslationStatus(msg.id, 'skipped');
    return 'skipped';
  }

  let translatedBody = msg.translated_body;
  let transcriptTranslated = msg.transcript_translated;
  let detected = msg.detected_language;

  if (hasBody) {
    const r = await translationService.translate(msg.body as string);
    translatedBody = r.translation;
    detected = r.detectedLanguage;
    if (r.inputTokens != null && r.outputTokens != null) {
      await costService
        .recordTranslation({ messageId: msg.id, inputTokens: r.inputTokens, outputTokens: r.outputTokens })
        .catch((err) => logger.error({ err, id: msg.id }, 'Failed to record translation cost'));
    }
  }
  if (hasTranscript) {
    const r = await translationService.translate(msg.transcript as string);
    transcriptTranslated = r.translation;
    if (!detected) detected = r.detectedLanguage;
    if (r.inputTokens != null && r.outputTokens != null) {
      await costService
        .recordTranslation({ messageId: msg.id, inputTokens: r.inputTokens, outputTokens: r.outputTokens })
        .catch((err) => logger.error({ err, id: msg.id }, 'Failed to record translation cost'));
    }
  }

  await messageService.setTranslation(msg.id, {
    translatedBody,
    transcriptTranslated,
    detectedLanguage: detected,
    status: 'done',
  });
  return 'translated';
}

// POST /messages/:id/translate — on-demand translation (body + transcript) via DeepSeek.
messagesRouter.post('/:id/translate', async (req, res, next) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }
  try {
    if (!translationService.available()) {
      res.status(503).json({ error: 'Translation is unavailable — configure a DeepSeek API key.' });
      return;
    }
    const msg = await messageService.getById(id);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await translateMessageRow(msg);
    res.json({ data: await messageService.getById(id) });
  } catch (err) {
    logger.error({ err, id }, 'Translation request failed');
    await messageService.setTranslationStatus(id, 'failed').catch(() => undefined);
    next(err);
  }
});

// POST /messages/:number/translate-all — translate every not-yet-translated message
// in a contact's thread (body + transcripts) via DeepSeek. Synchronous; runs in order.
messagesRouter.post('/:number/translate-all', async (req, res, next) => {
  try {
    if (!translationService.available()) {
      res.status(503).json({ error: 'Translation is unavailable — configure a DeepSeek API key.' });
      return;
    }
    const pending = await messageService.listUntranslated(req.params.number);
    let translated = 0;
    let skipped = 0;
    let failed = 0;
    for (const msg of pending) {
      try {
        const result = await translateMessageRow(msg);
        if (result === 'translated') translated += 1;
        else skipped += 1;
      } catch (err) {
        failed += 1;
        logger.error({ err, id: msg.id }, 'Bulk translation failed for message');
        await messageService.setTranslationStatus(msg.id, 'failed').catch(() => undefined);
      }
    }
    res.json({ data: { requested: pending.length, translated, skipped, failed } });
  } catch (err) {
    next(err);
  }
});

// POST /messages/:number/draft-reply — AI-generated reply draft based on
// recent conversation context + user's rough notes. Returns English reply
// AND a natural $target_language version (unless target is already English).
messagesRouter.post('/:number/draft-reply', async (req, res, next) => {
  const { number } = req.params;
  const body = req.body as { draft?: unknown; messageCount?: unknown };
  const draft = typeof body.draft === 'string' ? body.draft.trim() : '';
  const messageCount = typeof body.messageCount === 'number' && Number.isFinite(body.messageCount)
    ? Math.min(Math.max(Math.round(body.messageCount), 1), 20)
    : 1;

  if (!draft) {
    res.status(400).json({ error: '"draft" is required (a string with your rough notes)' });
    return;
  }

  try {
    if (!draftReplyService.available()) {
      res.status(503).json({ error: 'Draft reply is unavailable — configure a DeepSeek API key.' });
      return;
    }
    if (!whitelistService.isWhitelisted(number) && !groupService.isMonitored(number)) {
      res.status(403).json({ error: 'Not a whitelisted contact or monitored group' });
      return;
    }

    const rawMessages = await messageService.listByNumber(number, messageCount, 0);
    const contextMessages = [...rawMessages].reverse();

    const targetLanguage = await whitelistService.getPreferredLanguage(number);

    const result = await draftReplyService.generate(contextMessages, draft, targetLanguage);

    if (result.inputTokens != null && result.outputTokens != null) {
      await costService
        .recordDraftReply({ messageId: null, inputTokens: result.inputTokens, outputTokens: result.outputTokens })
        .catch((err) => logger.error({ err }, 'Failed to record draft reply cost'));
    }

    res.json({ data: result });
  } catch (err) {
    logger.error({ err, number }, 'Draft reply generation failed');
    next(err);
  }
});

// POST /messages/:number/read — mark a conversation (contact OR group) read up
// to now: clears its unread count and best-effort tells WhatsApp we've seen it
// (sendSeen → the other side's "read" ticks). `:number` is the thread id.
messagesRouter.post('/:number/read', async (req, res, next) => {
  const { number } = req.params;
  try {
    const isGroup = groupService.isMonitored(number);
    if (!whitelistService.isWhitelisted(number) && !isGroup) {
      res.status(403).json({ error: 'Not a whitelisted contact or monitored group' });
      return;
    }

    await readStateService.markRead(number);

    // Best-effort WhatsApp read receipt — never fail the request over it.
    const client = whatsappService.getClient();
    if (client && whatsappService.getState() === 'READY') {
      const [latest] = await messageService.listByNumber(number, 1, 0);
      const chatId = latest?.chat_id || (isGroup ? toGroupChatId(number) : toChatId(number));
      client.sendSeen(chatId).catch((err) => logger.error({ err, number }, 'sendSeen failed'));
    }

    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

const IMAGE_MEDIA_TYPES = new Set(['image', 'sticker']);

/** Read downloaded image files in a window into base64 data URLs for vision (capped). */
async function buildSummaryImages(messages: StoredMessage[]): Promise<{ dataUrl: string }[]> {
  const imageMsgs = messages.filter(
    (m) => IMAGE_MEDIA_TYPES.has(String(m.media_type)) && m.media_status === 'downloaded' && m.media_path,
  );
  const images: { dataUrl: string }[] = [];
  for (const m of imageMsgs) {
    if (images.length >= env.SUMMARY_MAX_IMAGES) {
      logger.info({ omitted: imageMsgs.length - images.length }, 'Summary: image cap reached, some images omitted');
      break;
    }
    try {
      const buf = await fs.promises.readFile(absoluteMediaPath(m.media_path as string));
      const mime = m.media_mimetype || 'image/jpeg';
      images.push({ dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
    } catch (err) {
      logger.warn({ err, id: m.id }, 'Summary: failed to read image file');
    }
  }
  return images;
}

// POST /messages/:number/summarize — AI summary of the last N minutes/hours of a
// thread (contact or group), including any images (vision). Persists to history.
messagesRouter.post('/:number/summarize', async (req, res, next) => {
  const { number } = req.params;
  const body = req.body as { amount?: unknown; unit?: unknown };
  const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? Math.round(body.amount) : 30;
  const unit = body.unit === 'hours' ? 'hours' : 'minutes';
  const windowMinutes = Math.min(Math.max(amount * (unit === 'hours' ? 60 : 1), 1), 7 * 24 * 60);

  try {
    if (!summarizationService.available()) {
      res.status(503).json({ error: 'Summarization is unavailable — configure an OpenAI API key.' });
      return;
    }
    if (!whitelistService.isWhitelisted(number) && !groupService.isMonitored(number)) {
      res.status(403).json({ error: 'Not a whitelisted contact or monitored group' });
      return;
    }

    const endMs = await messageService.getLastMessageTimestamp(number);
    if (endMs === null) {
      res.status(400).json({ error: 'Nothing to summarize — no messages captured for this conversation.' });
      return;
    }
    const startMs = endMs - windowMinutes * 60_000;
    const messages = await messageService.listByNumberBetween(number, startMs, endMs);
    if (messages.length === 0) {
      res.status(400).json({ error: `Nothing to summarize in the last ${windowMinutes} minute(s).` });
      return;
    }

    const images = await buildSummaryImages(messages);
    const result = await summarizationService.summarize(messages, images);

    const saved = await summaryService.create({
      contactNumber: number,
      title: result.title,
      body: result.body,
      windowMinutes,
      windowStart: new Date(startMs),
      windowEnd: new Date(endMs),
      messageCount: messages.length,
      imageCount: images.length,
    });

    if (result.inputTokens != null && result.outputTokens != null) {
      await costService
        .recordSummary({ inputTokens: result.inputTokens, outputTokens: result.outputTokens })
        .catch((err) => logger.error({ err }, 'Failed to record summary cost'));
    }

    res.status(201).json({ data: saved });
  } catch (err) {
    logger.error({ err, number }, 'Summarization failed');
    next(err);
  }
});

// GET /messages/:number/summaries — past summaries for a thread (newest first).
messagesRouter.get('/:number/summaries', async (req, res, next) => {
  try {
    res.json({ data: await summaryService.list(req.params.number) });
  } catch (err) {
    next(err);
  }
});

// GET /messages/:id/media — stream the locally-archived attachment.
messagesRouter.get('/:id/media', async (req, res, next) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    res.status(404).json({ error: 'No media for this message' });
    return;
  }
  try {
    const msg = await messageService.getById(id);
    if (!msg || !msg.media_path || msg.media_status !== 'downloaded') {
      res.status(404).json({ error: 'No media for this message' });
      return;
    }
    const abs = absoluteMediaPath(msg.media_path);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ error: 'Media file missing' });
      return;
    }
    const { size } = await fs.promises.stat(abs);
    if (msg.media_mimetype) res.setHeader('Content-Type', msg.media_mimetype);
    // Advertise range support so browsers can seek audio/video (Safari refuses
    // to play <video>/<audio> without 206 Partial Content responses).
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        const start = match[1] ? parseInt(match[1], 10) : size - parseInt(match[2], 10);
        const end = match[2] && match[1] ? parseInt(match[2], 10) : size - 1;
        if (start >= size || end >= size || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Content-Length', end - start + 1);
        fs.createReadStream(abs, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', size);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    next(err);
  }
});

// GET /messages/:number?limit=&offset=  — full thread for a contact (both directions).
// Pass `before` (ISO timestamp) + `beforeId` for drift-free keyset "load older"
// paging instead of offset — returns messages strictly older than that cursor.
messagesRouter.get('/:number', async (req, res, next) => {
  try {
    const q = req.query as Record<string, unknown>;
    const { limit, offset } = parsePaging(q);
    const before = parseStr(q.before);
    const beforeId = parseStr(q.beforeId);
    if (before && beforeId && /^\d+$/.test(beforeId)) {
      const data = await messageService.listByNumberBefore(req.params.number, before, beforeId, limit);
      res.json({ data, paging: { limit } });
      return;
    }
    const data = await messageService.listByNumber(req.params.number, limit, offset);
    res.json({ data, paging: { limit, offset } });
  } catch (err) {
    next(err);
  }
});
