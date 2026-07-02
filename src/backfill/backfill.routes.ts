import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { backfillService } from './backfill.service';
import { whatsappService } from '../whatsapp/client';

/**
 * Manual history backfill for whitelisted contacts. Runs in the background and
 * returns 202 immediately; poll GET /backfill/status for progress.
 */
export const backfillRouter = Router();

const dateVal = z.union([z.string(), z.number()]).optional();
const bodySchema = z.object({
  from: dateVal,
  since: dateVal,
  to: dateVal,
  until: dateVal,
});

/** ISO-8601 / epoch-ms → epoch ms. Returns NaN on invalid, undefined when absent. */
function toEpoch(v: string | number | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  if (/^\d+$/.test(v)) return Number(v);
  return Date.parse(v);
}

function runBackfill(req: Request, res: Response, number?: string): void {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const since = toEpoch(parsed.data.from ?? parsed.data.since);
  const until = toEpoch(parsed.data.to ?? parsed.data.until);
  if (since !== undefined && Number.isNaN(since)) {
    res.status(400).json({ error: 'Invalid "from" date' });
    return;
  }
  if (until !== undefined && Number.isNaN(until)) {
    res.status(400).json({ error: 'Invalid "to" date' });
    return;
  }
  if (whatsappService.getState() !== 'READY') {
    res.status(503).json({ error: 'WhatsApp client is not ready' });
    return;
  }
  if (backfillService.getStatus().running) {
    res.status(409).json({ error: 'A backfill is already running' });
    return;
  }

  backfillService.start({ number, since, until });
  res.status(202).json({ data: backfillService.getStatus() });
}

// GET /backfill/status
backfillRouter.get('/status', (_req, res) => {
  res.json({ data: backfillService.getStatus() });
});

// POST /backfill — all whitelisted contacts
backfillRouter.post('/', (req, res) => runBackfill(req, res));

// POST /backfill/:number — a single contact
backfillRouter.post('/:number', (req, res) => runBackfill(req, res, req.params.number));
