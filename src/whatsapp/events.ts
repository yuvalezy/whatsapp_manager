import type { Client, Message } from 'whatsapp-web.js';
import { env } from '../config/env';
import { logger } from '../logger';
import { printQrToTerminal } from './qr';
import { whitelistService } from '../whitelist/whitelist.service';
import { ignoredStats } from '../messages/ignored-stats';
import { normalizeNumber } from '../utils/phone';
import { RoutableMessage } from '../messages/message.model';
import { MessageRouter } from '../router/message-router';
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
    logger.info('QR code received — scan it in WhatsApp → Linked devices.');
    printQrToTerminal(qr);
    logger.info(`Prefer a browser? Open http://localhost:${env.PORT}/qr`);
  });

  client.on('authenticated', () => {
    service.setState('AUTHENTICATED');
    service.setLastQr(null);
    logger.info('WhatsApp authenticated — session will be persisted.');
  });

  client.on('auth_failure', (msg) => {
    service.setState('AUTH_FAILURE');
    logger.error({ msg }, 'WhatsApp authentication failed');
  });

  client.on('ready', () => {
    const info = client.info;
    service.markReady({
      pushname: info?.pushname,
      wid: info?.wid?._serialized,
    });
    logger.info({ pushname: info?.pushname }, 'WhatsApp client is READY');
  });

  client.on('disconnected', (reason) => {
    service.setState('DISCONNECTED');
    logger.warn({ reason }, 'WhatsApp disconnected');
  });

  // Incoming messages only (own outgoing messages are not emitted here).
  client.on('message', (message: Message) => {
    handleIncoming(message, router).catch((err) => {
      logger.error({ err }, 'Error handling incoming message');
    });
  });
}

/**
 * Core policy: process ONLY 1:1 messages from whitelisted numbers.
 * Everything else is counted (never stored/logged with content) and dropped.
 */
async function handleIncoming(message: Message, router: MessageRouter): Promise<void> {
  const from = message.from ?? '';
  const isGroup = from.endsWith('@g.us');

  if (from === 'status@broadcast') {
    ignoredStats.increment('status_broadcast');
    return;
  }
  if (isGroup && !env.MONITOR_GROUPS) {
    ignoredStats.increment('group');
    return;
  }

  const senderId = (isGroup ? message.author : from) ?? from;
  const senderNumber = normalizeNumber(senderId);

  if (!whitelistService.isWhitelisted(senderNumber)) {
    ignoredStats.increment('not_whitelisted');
    return;
  }

  // Best-effort contact name; never block ingestion on it.
  let senderName: string | undefined;
  try {
    const contact = await message.getContact();
    senderName = contact.pushname || contact.name || contact.verifiedName || undefined;
  } catch {
    /* contact lookup is optional */
  }

  const routable: RoutableMessage = {
    messageId: message.id._serialized,
    chatId: from,
    senderNumber,
    senderName,
    body: message.body ?? '',
    messageType: String(message.type),
    direction: 'inbound',
    timestamp: new Date(message.timestamp * 1000),
    metadata: {
      hasMedia: message.hasMedia,
      isForwarded: message.isForwarded,
      deviceType: message.deviceType,
      isGroup,
    },
  };

  await router.route(routable);
}
