import type { Client, Message } from 'whatsapp-web.js';
import { env } from '../config/env';
import { logger } from '../logger';
import { printQrToTerminal } from './qr';
import { whitelistService } from '../whitelist/whitelist.service';
import { ignoredStats } from '../messages/ignored-stats';
import { MessageRouter } from '../router/message-router';
import { buildRoutable, contactNumberOf } from './message-mapper';
import { backfillService } from '../backfill/backfill.service';
import { sseManager } from '../sse';
import { buildStatusData } from '../whatsapp/whatsapp.routes';
import type { WhatsAppService } from './client';

/**
 * Wire up all WhatsApp client events. Kept separate from client.ts so the
 * connection lifecycle and the message-handling policy are easy to read
 * independently.
 */
export function registerEvents(
  service: WhatsAppService,
  client: Client,
  router: MessageRouter,
): void {
  client.on('qr', (qr: string) => {
    service.setLastQr(qr);
    service.setState('QR_READY');
    sseManager.broadcast('status', buildStatusData());
    logger.info('QR code received — scan it in WhatsApp → Linked devices.');
    printQrToTerminal(qr);
    logger.info(`Prefer a browser? Open http://localhost:${env.PORT}/qr`);
  });

  client.on('authenticated', () => {
    if (service.getState() !== 'READY') {
      service.setState('AUTHENTICATED');
      sseManager.broadcast('status', buildStatusData());
    }
    service.setLastQr(null);
    logger.info('WhatsApp authenticated — session will be persisted.');
  });

  client.on('auth_failure', (msg) => {
    service.setState('AUTH_FAILURE');
    sseManager.broadcast('status', buildStatusData());
    logger.error({ msg }, 'WhatsApp authentication failed');
  });

  client.on('ready', () => {
    const info = client.info;
    service.markReady({
      pushname: info?.pushname,
      wid: info?.wid?._serialized,
    });
    sseManager.broadcast('status', buildStatusData());
    logger.info({ pushname: info?.pushname }, 'WhatsApp client is READY');

    // Close any gap left by downtime — backfills each whitelisted contact from
    // its own last-known message timestamp. No-ops for contacts never backfilled.
    backfillService.catchUpAll().catch((err) => {
      logger.error({ err }, 'Auto catch-up backfill failed');
    });
  });

  client.on('loading_screen', (percent, message) => {
    logger.info({ percent, message }, 'WhatsApp loading screen');
  });

  client.on('disconnected', (reason) => {
    service.setState('DISCONNECTED');
    sseManager.broadcast('status', buildStatusData());
    logger.warn({ reason }, 'WhatsApp disconnected');
  });

  // `message_create` fires for BOTH received and our own sent messages, so we
  // can capture the full two-sided thread (the plain `message` event suppresses
  // our own sends). Direction is derived from `message.id.fromMe`.
  client.on('message_create', (message: Message) => {
    handleMessage(service, message, router).catch((err) => {
      logger.error({ err }, 'Error handling message');
    });
  });
}

/**
 * Core policy: process ONLY 1:1 messages whose contact is whitelisted, in either
 * direction. Everything else is counted (never stored/logged with content) and
 * dropped. Our own outbound to non-whitelisted contacts is dropped silently.
 */
async function handleMessage(
  service: WhatsAppService,
  message: Message,
  router: MessageRouter,
): Promise<void> {
  const fromMe = message.id.fromMe;
  const from = message.from ?? '';
  const isGroup = from.endsWith('@g.us');

  if (from === 'status@broadcast' || message.to === 'status@broadcast') {
    if (!fromMe) ignoredStats.increment('status_broadcast');
    return;
  }
  if (isGroup && !env.MONITOR_GROUPS) {
    if (!fromMe) ignoredStats.increment('group');
    return;
  }

  const contactNumber = contactNumberOf(message);
  if (!whitelistService.isWhitelisted(contactNumber)) {
    // Count inbound noise; drop our own outbound to non-whitelisted silently.
    if (!fromMe) ignoredStats.increment('not_whitelisted');
    return;
  }

  const routable = await buildRoutable(message, service.getOwnNumber());
  await router.route(routable);
}
