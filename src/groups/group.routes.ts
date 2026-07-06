import { Router } from 'express';
import type { GroupChat } from 'whatsapp-web.js';
import { groupService, ValidationError } from './group.service';
import { whatsappService } from '../whatsapp/client';
import { normalizeNumber, toGroupChatId } from '../utils/phone';

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

// GET /groups/:groupId/participants — live member list of a monitored group,
// for the compose @-mention picker. Mirrors GET /contacts' LID resolution. Each
// entry:
//   jid    — serialized WID; the exact string to pass in sendMessage({ mentions })
//   user   — the jid's user part; the "@<user>" token to embed in the body
//   number — resolved real phone (LID-aware), for display + whitelist matching
//   name   — WhatsApp display name (pushname/name/verifiedName), or null
groupsRouter.get('/:groupId/participants', async (req, res, next) => {
  try {
    const client = whatsappService.getClient();
    if (!client || whatsappService.getState() !== 'READY') {
      res.status(503).json({ error: 'WhatsApp client is not ready' });
      return;
    }
    const groupId = normalizeNumber(req.params.groupId);
    if (!groupService.isMonitored(groupId)) {
      res.status(403).json({ error: 'Group is not monitored' });
      return;
    }

    const chat = (await client.getChatById(toGroupChatId(groupId))) as GroupChat;
    const participants = chat?.participants ?? [];

    // Batch-resolve LID-addressed members to real numbers (same as GET /contacts).
    const lidJids = participants.filter((p) => p.id.server === 'lid').map((p) => p.id._serialized);
    const resolved = lidJids.length > 0 ? await client.getContactLidAndPhone(lidJids) : [];
    const lidToPhone = new Map(resolved.map((r) => [r.lid, normalizeNumber(r.pn)]));
    const ownNumber = whatsappService.getOwnNumber();

    interface ParticipantSummary {
      jid: string;
      user: string;
      number: string;
      name: string | null;
    }

    const rows = await Promise.all(
      participants.map(async (p): Promise<ParticipantSummary> => {
        const jid = p.id._serialized;
        const user = p.id.user;
        const number =
          p.id.server === 'lid' ? (lidToPhone.get(jid) ?? normalizeNumber(user)) : normalizeNumber(user);
        let name: string | null = null;
        try {
          const contact = await client.getContactById(jid);
          name = contact.pushname || contact.name || contact.verifiedName || null;
        } catch {
          /* name is best-effort — same as buildRoutable's senderName */
        }
        return { jid, user, number, name };
      }),
    );

    const data = rows
      .filter((r) => r.number && r.number !== ownNumber)
      .sort((a, b) => {
        if (!!a.name !== !!b.name) return a.name ? -1 : 1; // named first
        return (a.name ?? a.number).localeCompare(b.name ?? b.number);
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
