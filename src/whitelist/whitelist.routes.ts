import { Router } from 'express';
import { whitelistService, ValidationError } from './whitelist.service';

export const whitelistRouter = Router();

// GET /whitelist — list all allowed numbers
whitelistRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ data: await whitelistService.list() });
  } catch (err) {
    next(err);
  }
});

// POST /whitelist — { number, label? }
whitelistRouter.post('/', async (req, res, next) => {
  try {
    const { number, label } = (req.body ?? {}) as { number?: unknown; label?: unknown };
    if (!number) {
      res.status(400).json({ error: 'Field "number" is required' });
      return;
    }
    const entry = await whitelistService.add(
      String(number),
      label != null ? String(label) : undefined,
    );
    res.status(201).json({ data: entry });
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// DELETE /whitelist/:number
whitelistRouter.delete('/:number', async (req, res, next) => {
  try {
    const removed = await whitelistService.remove(req.params.number);
    if (!removed) {
      res.status(404).json({ error: 'Number not found in whitelist' });
      return;
    }
    res.json({ data: { removed: true } });
  } catch (err) {
    next(err);
  }
});
