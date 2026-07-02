import { Router } from 'express';
import { ezyPortalService } from './ezy-portal.service';

/**
 * Proxy for the EZY Portal tenant API — business partner search + contacts,
 * used by the whitelist's "link to EZY Portal" flow. Responses are passed
 * through as-is; the tenant API key never leaves the backend.
 */
export const ezyPortalRouter = Router();

ezyPortalRouter.use((_req, res, next) => {
  if (!ezyPortalService.available()) {
    res.status(503).json({ error: 'EZY Portal is not configured. Add the "ezy_portal" API key in Settings.' });
    return;
  }
  next();
});

// GET /ezy-portal/business-partners?query=
ezyPortalRouter.get('/business-partners', async (req, res, next) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : undefined;
    const items = await ezyPortalService.listBusinessPartners(query);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// GET /ezy-portal/business-partners/:bpId/contacts
ezyPortalRouter.get('/business-partners/:bpId/contacts', async (req, res, next) => {
  try {
    const items = await ezyPortalService.listContacts(req.params.bpId);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// POST /ezy-portal/business-partners/:bpId/contacts — { firstName, lastName, role?, email?, mobile?, whatsapp?, jobTitle? }
ezyPortalRouter.post('/business-partners/:bpId/contacts', async (req, res, next) => {
  try {
    const { firstName, lastName, role, email, mobile, whatsapp, jobTitle } = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim()) {
      res.status(400).json({ error: '"firstName" and "lastName" are required' });
      return;
    }
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const contact = await ezyPortalService.createContact(req.params.bpId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: str(role),
      email: str(email),
      mobile: str(mobile),
      whatsapp: str(whatsapp),
      jobTitle: str(jobTitle),
    });
    res.status(201).json({ data: contact });
  } catch (err) {
    next(err);
  }
});
