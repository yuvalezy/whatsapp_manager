import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { backfillService } from './backfill.service';
import { parseDateWindow } from './date-window';
import { whatsappService } from '../whatsapp/client';
import { groupService } from '../groups/group.service';

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

function runBackfill(req: Request, res: Response, target: { number?: string; groupId?: string } = {}): void {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  // The API is the authoritative guard for the date window (see date-window.ts):
  // it expands date-only bounds to UTC calendar-day boundaries and rejects
  // inverted ranges. The UI mirrors this for inline feedback, but the backend
  // decision is final.
  const window = parseDateWindow(parsed.data);
  if (!window.ok) {
    res.status(400).json({ error: window.error });
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

  backfillService.start({ ...target, ...window.window });
  res.status(202).json({ data: backfillService.getStatus() });
}

// GET /backfill/status
backfillRouter.get('/status', (_req, res) => {
  res.json({ data: backfillService.getStatus() });
});

// POST /backfill — all whitelisted contacts + monitored groups
backfillRouter.post('/', (req, res) => runBackfill(req, res));

// POST /backfill/group/:groupId — a single monitored group (registered before
// /:number so it isn't swallowed by the single-segment contact route). Only
// monitored groups can be backfilled — group content is stored for opted-in
// groups only (privacy invariant).
backfillRouter.post('/group/:groupId', (req, res) => {
  if (!groupService.isMonitored(req.params.groupId)) {
    res.status(404).json({ error: 'Group is not monitored' });
    return;
  }
  runBackfill(req, res, { groupId: req.params.groupId });
});

// POST /backfill/:number — a single contact
backfillRouter.post('/:number', (req, res) => runBackfill(req, res, { number: req.params.number }));
