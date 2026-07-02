import { Router } from 'express';
import fs from 'node:fs';
import { messageService } from './message.service';
import { translationService } from '../enrichment/translation.service';
import { absoluteMediaPath } from '../media/media.service';
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

    const hasBody = !!msg.body && msg.body.trim() !== '';
    const hasTranscript = !!msg.transcript && msg.transcript.trim() !== '';
    if (!hasBody && !hasTranscript) {
      await messageService.setTranslationStatus(id, 'skipped');
      res.json({ data: await messageService.getById(id) });
      return;
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

    await messageService.setTranslation(id, {
      translatedBody,
      transcriptTranslated,
      detectedLanguage: detected,
      status: 'done',
    });
    res.json({ data: await messageService.getById(id) });
  } catch (err) {
    logger.error({ err, id }, 'Translation request failed');
    await messageService.setTranslationStatus(id, 'failed').catch(() => undefined);
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
