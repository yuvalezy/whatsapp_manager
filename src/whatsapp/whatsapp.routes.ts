import { Router } from 'express';
import { whatsappService } from './client';
import { qrToDataUrl, qrHtmlPage } from './qr';
import { whitelistService } from '../whitelist/whitelist.service';
import { groupService } from '../groups/group.service';
import { ignoredStats } from '../messages/ignored-stats';
import { env } from '../config/env';
import { transcriptionService } from '../enrichment/transcription.service';
import { translationService } from '../enrichment/translation.service';
import { normalizeNumber } from '../utils/phone';

/** Assemble the full status snapshot for /status and SSE broadcasts. */
export function buildStatusData() {
  const hasOpenAiKey = transcriptionService.available();
  return {
    ...whatsappService.status(),
    whitelistCount: whitelistService.size(),
    outboundEnabled: env.ENABLE_OUTBOUND,
    monitorGroups: groupService.size() > 0,
    monitoredGroupCount: groupService.size(),
    ignored: ignoredStats.snapshot(),
    ignoredTotal: ignoredStats.total(),
    transcriptionEnabled: env.ENABLE_TRANSCRIPTION && hasOpenAiKey,
    hasOpenAiKey,
    hasDeepseekKey: translationService.available(),
  };
}

export const whatsappRouter = Router();

// GET /qr — HTML page for browsers, or JSON with `?format=json`
whatsappRouter.get('/qr', async (req, res, next) => {
  try {
    const qr = whatsappService.getLastQr();
    const state = whatsappService.getState();
    const dataUrl = qr ? await qrToDataUrl(qr) : null;

    if (req.query.format === 'json') {
      res.json({ data: { state, qr, dataUrl } });
      return;
    }
    res.type('html').send(qrHtmlPage(dataUrl, state));
  } catch (err) {
    next(err);
  }
});

// GET /status — connection + monitoring snapshot
whatsappRouter.get('/status', (_req, res) => {
  res.json({ data: buildStatusData() });
});

// GET /contacts — real WhatsApp conversations (1:1 chats) from the linked
// account, for the whitelist "browse contacts" picker. Uses getChats() rather
// than getContacts(): the latter is the *entire* synced phone book (often
// thousands of entries, each duplicated once per phone number and once per
// privacy LID). Most active chats are LID-addressed (chat.id.user is an
// opaque id, not a phone number) — real numbers are resolved in one batched
// call via getContactLidAndPhone(). Excludes groups, read-only/system chats,
// and your own self-chat.
whatsappRouter.get('/contacts', async (_req, res, next) => {
  try {
    const client = whatsappService.getClient();
    if (!client || whatsappService.getState() !== 'READY') {
      res.status(503).json({ error: 'WhatsApp client is not ready' });
      return;
    }
    const ownNumber = whatsappService.getOwnNumber();
    const [allChats, whitelist] = await Promise.all([client.getChats(), whitelistService.list()]);
    const whitelisted = new Set(whitelist.map((w) => w.phone_number));

    const chats = allChats.filter((c) => !c.isGroup && !c.isReadOnly);
    const lidIds = chats.filter((c) => c.id.server === 'lid').map((c) => c.id._serialized);
    const resolved = lidIds.length > 0 ? await client.getContactLidAndPhone(lidIds) : [];
    const lidToPhone = new Map(resolved.map((r) => [r.lid, normalizeNumber(r.pn)]));

    interface ContactSummary {
      number: string;
      name: string;
      lastActivity: string | null;
      whitelisted: boolean;
    }
    const byNumber = new Map<string, ContactSummary>();

    for (const c of chats) {
      const number =
        c.id.server === 'lid'
          ? (lidToPhone.get(c.id._serialized) ?? normalizeNumber(c.id.user))
          : normalizeNumber(c.id.user);
      if (!number || number === ownNumber) continue;

      const lastActivity = c.timestamp ? new Date(c.timestamp * 1000).toISOString() : null;
      const existing = byNumber.get(number);
      if (existing && (!lastActivity || (existing.lastActivity ?? '') >= lastActivity)) continue;
      byNumber.set(number, {
        number,
        name: c.name || number,
        lastActivity,
        whitelisted: whitelisted.has(number),
      });
    }

    const data = [...byNumber.values()].sort((a, b) => {
      if (a.whitelisted !== b.whitelisted) return a.whitelisted ? 1 : -1;
      if (a.lastActivity && b.lastActivity) return b.lastActivity.localeCompare(a.lastActivity);
      if (a.lastActivity) return -1;
      if (b.lastActivity) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});
