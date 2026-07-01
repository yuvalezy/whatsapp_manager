import { Router } from 'express';
import { messageService } from './message.service';

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

// GET /messages/:number?limit=&offset=
messagesRouter.get('/:number', async (req, res, next) => {
  try {
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    const data = await messageService.listByNumber(req.params.number, limit, offset);
    res.json({ data, paging: { limit, offset } });
  } catch (err) {
    next(err);
  }
});
