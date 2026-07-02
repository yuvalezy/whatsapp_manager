import { Router } from 'express';
import fs from 'node:fs';
import { messageService } from './message.service';
import { StoredMessage } from './message.model';
import { translationService } from '../enrichment/translation.service';
import { absoluteMediaPath } from '../media/media.service';
import { whitelistService } from '../whitelist/whitelist.service';
import { logger } from '../logger';

export const messagesRouter = Router();

function parsePaging(query: Record<string, unknown>): { limit: number; offset: number } {
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

// GET /messages?limit=&offset=
messagesRouter.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    res.json({ data: await messageService.list(limit, offset), paging: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /messages/threads — one row per whitelisted contact (their latest message),
// sorted by recency, for the Conversations inbox view.
messagesRouter.get('/threads', async (_req, res, next) => {
  try {
    const [contacts, latest] = await Promise.all([whitelistService.list(), messageService.listThreads()]);
    const byNumber = new Map(latest.map((m) => [m.contact_number, m]));
    const threads = contacts
      .map((c) => ({
        phone_number: c.phone_number,
        label: c.label,
        lastMessage: byNumber.get(c.phone_number) ?? null,
      }))
      .sort((a, b) => {
        const at = a.lastMessage?.timestamp;
        const bt = b.lastMessage?.timestamp;
        if (at && bt) return new Date(bt).getTime() - new Date(at).getTime();
        if (at) return -1;
        if (bt) return 1;
        return (a.label ?? a.phone_number).localeCompare(b.label ?? b.phone_number);
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
  }
  if (hasTranscript) {
    const r = await translationService.translate(msg.transcript as string);
    transcriptTranslated = r.translation;
    if (!detected) detected = r.detectedLanguage;
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
    if (msg.media_mimetype) res.setHeader('Content-Type', msg.media_mimetype);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    next(err);
  }
});

// GET /messages/:number?limit=&offset=  — full thread for a contact (both directions).
messagesRouter.get('/:number', async (req, res, next) => {
  try {
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    const data = await messageService.listByNumber(req.params.number, limit, offset);
    res.json({ data, paging: { limit, offset } });
  } catch (err) {
    next(err);
  }
});
