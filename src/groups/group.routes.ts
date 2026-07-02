import { Router } from 'express';
import { groupService, ValidationError } from './group.service';
import { whatsappService } from '../whatsapp/client';
import { normalizeNumber } from '../utils/phone';

export const groupsRouter = Router();

// GET /groups — list monitored groups
groupsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ data: await groupService.list() });
  } catch (err) {
    next(err);
  }
});

// GET /groups/available — real WhatsApp groups from the linked account, for the
// "add group conversations" picker. Mirrors GET /contacts but keeps only groups.
// Group ids are `@g.us` (never LID-addressed), so no LID resolution is needed.
groupsRouter.get('/available', async (_req, res, next) => {
  try {
    const client = whatsappService.getClient();
    if (!client || whatsappService.getState() !== 'READY') {
      res.status(503).json({ error: 'WhatsApp client is not ready' });
      return;
    }
    const [allChats, monitored] = await Promise.all([client.getChats(), groupService.list()]);
    const monitoredIds = new Set(monitored.map((g) => g.group_id));

    interface GroupSummary {
      groupId: string;
      chatId: string;
      subject: string;
      lastActivity: string | null;
      monitored: boolean;
    }
    const byId = new Map<string, GroupSummary>();

    for (const c of allChats) {
      if (!c.isGroup) continue;
      const chatId = c.id._serialized;
      const groupId = normalizeNumber(chatId);
      if (!groupId || byId.has(groupId)) continue;
      byId.set(groupId, {
        groupId,
        chatId,
        subject: c.name || groupId,
        lastActivity: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : null,
        monitored: monitoredIds.has(groupId),
      });
    }

    const data = [...byId.values()].sort((a, b) => {
      if (a.monitored !== b.monitored) return a.monitored ? 1 : -1;
      if (a.lastActivity && b.lastActivity) return b.lastActivity.localeCompare(a.lastActivity);
      if (a.lastActivity) return -1;
      if (b.lastActivity) return 1;
      return a.subject.localeCompare(b.subject);
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /groups — { groupId, chatId, subject? }
groupsRouter.post('/', async (req, res, next) => {
  try {
    const { groupId, chatId, subject } = (req.body ?? {}) as Record<string, unknown>;
    if (!groupId || !chatId) {
      res.status(400).json({ error: 'Fields "groupId" and "chatId" are required' });
      return;
    }
    const entry = await groupService.add(
      String(groupId),
      String(chatId),
      subject != null ? String(subject) : undefined,
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

// PUT /groups/:id/ezy-link — { bpId, bpCode, bpName }. BP-only: a group links to a
// business partner WITHOUT a contact (unlike the whitelist link).
groupsRouter.put('/:id/ezy-link', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid group id' });
      return;
    }
    const { bpId, bpCode, bpName } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof bpId !== 'string' || !bpId.trim() || typeof bpName !== 'string') {
      res.status(400).json({ error: '"bpId" and "bpName" are required' });
      return;
    }
    const entry = await groupService.setEzyLink(id, {
      bpId: bpId.trim(),
      bpCode: typeof bpCode === 'string' ? bpCode.trim() : '',
      bpName: bpName.trim(),
    });
    if (!entry) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    res.json({ data: entry });
  } catch (err) {
    next(err);
  }
});

// DELETE /groups/:groupId — stop monitoring a group
groupsRouter.delete('/:groupId', async (req, res, next) => {
  try {
    const removed = await groupService.remove(req.params.groupId);
    if (!removed) {
      res.status(404).json({ error: 'Group not found in monitoring' });
      return;
    }
    res.json({ data: { removed: true } });
  } catch (err) {
    next(err);
  }
});
