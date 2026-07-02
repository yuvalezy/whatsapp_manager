import { Router } from 'express';
import { whitelistService, ValidationError, PreferredLanguage } from './whitelist.service';

const PREFERRED_LANGUAGES: readonly PreferredLanguage[] = ['es', 'en', 'he'];

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

// PUT /whitelist/:id/ezy-link — { bpId, bpCode, bpName, contactId, contactName }
whitelistRouter.put('/:id/ezy-link', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid whitelist id' });
      return;
    }
    const { bpId, bpCode, bpName, contactId, contactName } = (req.body ?? {}) as Record<string, unknown>;
    if (
      typeof bpId !== 'string' ||
      !bpId.trim() ||
      typeof contactId !== 'string' ||
      !contactId.trim() ||
      typeof bpName !== 'string' ||
      typeof contactName !== 'string'
    ) {
      res.status(400).json({ error: '"bpId", "bpName", "contactId", and "contactName" are required' });
      return;
    }
    const entry = await whitelistService.setEzyLink(id, {
      bpId: bpId.trim(),
      bpCode: typeof bpCode === 'string' ? bpCode.trim() : '',
      bpName: bpName.trim(),
      contactId: contactId.trim(),
      contactName: contactName.trim(),
    });
    if (!entry) {
      res.status(404).json({ error: 'Whitelist entry not found' });
      return;
    }
    res.json({ data: entry });
  } catch (err) {
    next(err);
  }
});

// PUT /whitelist/:id — edit label and/or preferred_language.
// { label?: string | null, preferred_language?: 'es' | 'en' | 'he' }
whitelistRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid whitelist id' });
      return;
    }
    const body = (req.body ?? {}) as { label?: unknown; preferred_language?: unknown };
    const updates: { label?: string | null; preferredLanguage?: PreferredLanguage } = {};

    if ('label' in body) {
      const { label } = body;
      if (label !== null && typeof label !== 'string') {
        res.status(400).json({ error: '"label" must be a string or null' });
        return;
      }
      updates.label = label;
    }

    if ('preferred_language' in body) {
      const lang = body.preferred_language;
      if (!PREFERRED_LANGUAGES.includes(lang as PreferredLanguage)) {
        res.status(400).json({ error: '"preferred_language" must be one of: es, en, he' });
        return;
      }
      updates.preferredLanguage = lang as PreferredLanguage;
    }

    if (updates.label === undefined && updates.preferredLanguage === undefined) {
      res.status(400).json({ error: 'Provide at least one of "label" or "preferred_language"' });
      return;
    }

    const entry = await whitelistService.updateEntry(id, updates);
    if (!entry) {
      res.status(404).json({ error: 'Whitelist entry not found' });
      return;
    }
    res.json({ data: entry });
  } catch (err) {
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
