import { logger } from '../logger';
import { RoutableMessage } from '../messages/message.model';
import { messageService } from '../messages/message.service';

/**
 * MessageRouter is the single seam between WhatsApp ingestion and any
 * downstream system (storage, webhooks, CRM, AI orchestrator, ...).
 *
 * The WhatsApp layer only ever calls `route()` — swap or compose
 * implementations here without touching ingestion.
 */
export interface MessageRouter {
  route(message: RoutableMessage): Promise<void>;
}

/** Default sink: persist to Postgres and log a redacted line (no content). */
export class StorageMessageRouter implements MessageRouter {
  async route(message: RoutableMessage): Promise<void> {
    const inserted = await messageService.save(message);
    logger.info(
      {
        messageId: message.messageId,
        from: message.senderNumber,
        name: message.senderName,
        type: message.messageType,
        chars: message.body?.length ?? 0,
        duplicate: !inserted,
      },
      'Message routed → storage',
    );
  }
}

/**
 * Fan-out to multiple routers. One failing router never blocks the others,
 * so adding a flaky webhook later can't break message persistence.
 */
export class CompositeMessageRouter implements MessageRouter {
  constructor(private readonly routers: MessageRouter[]) {}

  async route(message: RoutableMessage): Promise<void> {
    const results = await Promise.allSettled(this.routers.map((r) => r.route(message)));
    for (const r of results) {
      if (r.status === 'rejected') {
        logger.error({ err: r.reason }, 'A downstream router failed');
      }
    }
  }
}

// ── Future routers (kept as a reference for the clean extension point) ──
//
// export class WebhookMessageRouter implements MessageRouter {
//   constructor(private readonly url: string) {}
//   async route(message: RoutableMessage) {
//     await fetch(this.url, { method: 'POST', body: JSON.stringify(message) });
//   }
// }
//
// export class AiOrchestratorRouter implements MessageRouter { ... }

/** The app-wide router instance. Add more routers to the array to extend. */
export const messageRouter: MessageRouter = new CompositeMessageRouter([
  new StorageMessageRouter(),
]);
