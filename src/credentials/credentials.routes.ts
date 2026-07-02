import { Router } from 'express';
import { credentialsService } from './credentials.service';

/**
 * Manage the encrypted credentials store over REST. Responses never contain
 * plaintext — only names, `last4`, and timestamps. Guarded by the app-wide
 * apiKeyGuard (mounted in app.ts).
 */
export const credentialsRouter = Router();

const NAME_RE = /^[a-z0-9_-]{2,64}$/;

// GET /credentials — { enabled, items } (masked)
credentialsRouter.get('/', async (_req, res, next) => {
  try {
    const items = credentialsService.enabled() ? await credentialsService.list() : [];
    res.json({ data: { enabled: credentialsService.enabled(), items } });
  } catch (err) {
    next(err);
  }
});

// PUT /credentials/:name — { value }
credentialsRouter.put('/:name', async (req, res, next) => {
  try {
    if (!credentialsService.enabled()) {
      res.status(503).json({
        error: 'Encrypted credentials store is disabled. Set CREDENTIALS_ENCRYPTION_KEY.',
      });
      return;
    }
    const name = String(req.params.name ?? '')
      .trim()
      .toLowerCase();
    if (!NAME_RE.test(name)) {
      res.status(400).json({ error: 'Invalid credential name (use a-z, 0-9, _ or -).' });
      return;
    }
    const value = (req.body ?? {}).value;
    if (typeof value !== 'string' || value.trim() === '') {
      res.status(400).json({ error: '"value" is required' });
      return;
    }
    const summary = await credentialsService.set(name, value.trim());
    res.status(200).json({ data: summary });
  } catch (err) {
    next(err);
  }
});

// DELETE /credentials/:name
credentialsRouter.delete('/:name', async (req, res, next) => {
  try {
    const name = String(req.params.name ?? '')
      .trim()
      .toLowerCase();
    const removed = await credentialsService.remove(name);
    res.json({ data: { removed } });
  } catch (err) {
    next(err);
  }
});
