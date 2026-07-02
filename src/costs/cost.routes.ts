import { Router } from 'express';
import { costService } from './cost.service';

/**
 * Read-only API cost tracking (OpenAI transcription, DeepSeek translation).
 * Costs are recorded at call time by the transcription worker and the
 * translate routes — this router only reads `api_costs`.
 */
export const costsRouter = Router();

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// GET /costs/summary — per-provider totals for the current calendar month
// (UTC), plus the combined total. Powers the dashboard KPI.
costsRouter.get('/summary', async (_req, res, next) => {
  try {
    const from = startOfMonth();
    const [monthly, allTime] = await Promise.all([
      costService.summary({ from }),
      costService.summary(),
    ]);
    res.json({
      data: {
        month: from.toISOString().slice(0, 7),
        monthlyTotal: monthly.reduce((sum, r) => sum + r.cost_usd, 0),
        monthlyByProvider: monthly,
        allTimeTotal: allTime.reduce((sum, r) => sum + r.cost_usd, 0),
        allTimeByProvider: allTime,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /costs/daily?days=30 — per-day, per-provider totals for a simple trend table.
costsRouter.get('/daily', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    res.json({ data: await costService.dailyBreakdown({ from }) });
  } catch (err) {
    next(err);
  }
});

// GET /costs?limit=100 — recent individual call records.
costsRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    res.json({ data: await costService.listRecent(limit) });
  } catch (err) {
    next(err);
  }
});
