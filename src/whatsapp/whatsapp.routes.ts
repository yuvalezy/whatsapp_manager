import { Router } from 'express';
import { whatsappService } from './client';
import { qrToDataUrl, qrHtmlPage } from './qr';
import { whitelistService } from '../whitelist/whitelist.service';
import { ignoredStats } from '../messages/ignored-stats';
import { env } from '../config/env';

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
  res.json({
    data: {
      ...whatsappService.status(),
      whitelistCount: whitelistService.size(),
      outboundEnabled: env.ENABLE_OUTBOUND,
      monitorGroups: env.MONITOR_GROUPS,
      ignored: ignoredStats.snapshot(),
      ignoredTotal: ignoredStats.total(),
    },
  });
});
