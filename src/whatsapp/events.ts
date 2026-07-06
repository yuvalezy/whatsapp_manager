import type { Client, Message, Reaction } from 'whatsapp-web.js';
import { env } from '../config/env';
import { logger } from '../logger';
import { printQrToTerminal } from './qr';
import { whitelistService } from '../whitelist/whitelist.service';
import { groupService } from '../groups/group.service';
import { ignoredStats } from '../messages/ignored-stats';
import { messageService } from '../messages/message.service';
import { reactionService } from '../reactions/reaction.service';
import { MessageRouter } from '../router/message-router';
import type { RoutableMessage } from '../messages/message.model';
import { buildRoutable, contactJidOf } from './message-mapper';
import { isSkippableType } from './message-types';
import { resolveContactNumber } from './lid-resolver';
import { normalizeNumber } from '../utils/phone';
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
    // A disconnected client is dead and would otherwise serve DISCONNECTED
    // forever. Attempt to recover the session (capped backoff; LOGOUT is
    // terminal). Recovery is internal to the service — no HTTP surface.
    service.scheduleReconnect(String(reason));
  });

  // `message_create` fires for BOTH received and our own sent messages, so we
  // can capture the full two-sided thread (the plain `message` event suppresses
  // our own sends). Direction is derived from `message.id.fromMe`.
  client.on('message_create', (message: Message) => {
    handleMessage(service, client, message, router).catch((err) => {
      logger.error({ err }, 'Error handling message');
    });
  });

  // Delivery-state updates for our own outbound messages (sent → delivered → read).
  // Patches an existing stored row rather than ingesting a new message, so it
  // talks to the message service directly instead of the router seam.
  client.on('message_ack', (message: Message, ack: number) => {
    messageService.updateAck(message.id._serialized, ack).catch((err) => {
      logger.error({ err }, 'Error updating message ack');
    });
  });

  // Emoji reactions (sent/received/updated/removed). Privacy is enforced in the
  // reaction service: only reactions whose target message we already store are
  // kept (FK gate) — reactions on ignored chats are dropped, never persisted.
  client.on('message_reaction', (reaction: Reaction) => {
    handleReaction(client, reaction).catch((err) => {
      logger.error({ err }, 'Error handling reaction');
    });
  });

  // In-place body edits ("edit message"). updateBody no-ops on message ids we
  // don't store, so edits to ignored chats have no effect (privacy preserved).
  client.on('message_edit', (message: Message, newBody) => {
    messageService
      .updateBody(message.id._serialized, String(newBody ?? message.body ?? ''), new Date())
      .catch((err) => logger.error({ err }, 'Error applying message edit'));
  });

  // "Delete for everyone" (revoke). Soft-deletes the stored row via the original
  // message id (from the revoked-message param, falling back to the revoke
  // stanza's protocolMessageKey). We pass the revoke event's own chat (`message.from`)
  // so markDeleted can scope by chat_id — the library recovers the revoked id from
  // a single global `last_message`, so without the chat guard a revoke in one chat
  // could soft-delete a message in another. markDeleted no-ops on unknown ids, so
  // revokes in ignored chats have no effect. Note: `message_revoke_me` is deliberately
  // NOT wired — it is a local-only "delete for me" hide, not a real deletion of
  // the conversation record, and is_deleted is documented as "delete for everyone".
  client.on('message_revoke_everyone', (message: Message, revoked?: Message | null) => {
    const revokedId = revoked?.id?._serialized ?? message.protocolMessageKey?._serialized;
    if (!revokedId) return;
    messageService
      .markDeleted(revokedId, new Date(), message.from)
      .catch((err) => logger.error({ err }, 'Error marking message deleted'));
  });
}

/**
 * Record a reaction. The reactor is resolved to a real number (LID-aware, same
 * as message attribution); the privacy gate lives in the reaction service (a
 * reaction is stored only if its target message is stored), so no whitelist /
 * group policy check is needed here.
 */
async function handleReaction(client: Client, reaction: Reaction): Promise<void> {
  const targetMessageId = reaction.msgId?._serialized;
  if (!targetMessageId) return;

  const senderNumber = await resolveContactNumber(client, reaction.senderId ?? '');
  await reactionService.record({
    messageId: targetMessageId,
    senderNumber,
    reaction: reaction.reaction ?? '',
    timestamp: reaction.timestamp ? new Date(reaction.timestamp * 1000) : new Date(),
  });
}

/**
 * Core policy, in either direction:
 *  - 1:1 messages are processed only when the contact is whitelisted.
 *  - Group messages are processed only when the group is in the monitored-group
 *    registry (explicit opt-in — no global switch); then EVERY member's message
 *    is stored, keyed to the group thread with per-author attribution.
 * Everything else is counted (never stored/logged with content) and dropped.
 * Our own outbound to non-monitored targets is dropped silently.
 */
async function handleMessage(
  service: WhatsAppService,
  client: Client,
  message: Message,
  router: MessageRouter,
): Promise<void> {
  const fromMe = message.id.fromMe;
  const from = message.from ?? '';
  const to = message.to ?? '';
  // The conversation this message belongs to (the group jid for group messages,
  // the other party for 1:1) — direction-aware so our own outbound is keyed to
  // the same thread as inbound.
  const chatJid = fromMe ? to : from;
  const isGroup = chatJid.endsWith('@g.us');

  if (from === 'status@broadcast' || to === 'status@broadcast') {
    if (!fromMe) ignoredStats.increment('status_broadcast');
    return;
  }

  let routable: RoutableMessage;

  if (isGroup) {
    const groupId = normalizeNumber(chatJid);
    if (!groupService.isMonitored(groupId)) {
      if (!fromMe) ignoredStats.increment('group');
      return;
    }
    // Drop system/non-conversational frames so monitored groups don't collect
    // empty junk rows — matches what backfill already filters (identical rows).
    if (isSkippableType(String(message.type))) return;
    // Pin the group id as the thread key; resolve the real author for
    // per-message attribution (sender_number/sender_name).
    const authorNumber = fromMe
      ? service.getOwnNumber()
      : await resolveContactNumber(client, message.author ?? from);
    routable = await buildRoutable(message, service.getOwnNumber(), groupId, authorNumber, undefined, client);
  } else {
    // 1:1 path. LID-addressed chats normalize to opaque digits that never match
    // the whitelist — resolve to the real phone number BEFORE the policy check.
    const contactNumber = await resolveContactNumber(client, contactJidOf(message));
    if (!whitelistService.isWhitelisted(contactNumber)) {
      // Count inbound noise; drop our own outbound to non-whitelisted silently.
      if (!fromMe) ignoredStats.increment('not_whitelisted');
      return;
    }

    // Same system-frame filter for whitelisted 1:1 (backfill already skips these).
    if (isSkippableType(String(message.type))) return;

    routable = await buildRoutable(message, service.getOwnNumber(), contactNumber, undefined, undefined, client);
  }

  // Live WhatsApp-side signals used only to gate the frontend's browser
  // notification: respect the account's own mute setting for this chat,
  // unless we were personally @mentioned (LID-aware, same resolution as
  // author attribution above). Skipped for our own outbound — nothing to
  // notify on, and avoids a wasted live lookup.
  if (!fromMe) {
    const [chat, mentionsMe] = await Promise.all([
      message.getChat().catch(() => null),
      mentionsOwner(client, message, service.getOwnNumber()),
    ]);
    routable.metadata = { ...routable.metadata, chatMuted: chat?.isMuted ?? false, mentionsMe };
  }

  await router.route(routable);
}

/** Whether this message @mentions our own account (LID-aware). */
async function mentionsOwner(client: Client, message: Message, ownNumber: string): Promise<boolean> {
  if (!message.mentionedIds?.length) return false;
  const resolved = await Promise.all(
    message.mentionedIds.map((jid) => resolveContactNumber(client, jid)),
  );
  return resolved.includes(ownNumber);
}
