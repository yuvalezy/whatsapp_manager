import crypto from 'node:crypto';
import { logger } from '../logger';
import type { MessageRouter } from './message-router';
import type { RoutableMessage } from '../messages/message.model';

/**
 * Fan-out router that POSTs each already-routable (whitelisted contact /
 * monitored group) message to an external webhook as JSON.
 *
 * The seam only ever hands us messages that already passed the privacy policy,
 * so no extra gating is needed here. It is wired into the composite ONLY when
 * WEBHOOK_URL is configured (see message-router.ts).
 *
 * Contract with the composite: this MUST NOT throw. The composite fans out with
 * Promise.allSettled, but we still catch every failure here so a slow or flaky
 * webhook can never affect persistence — and we never log message bodies.
 *
 * Signature: when a secret is configured the request carries
 *   X-Signature: sha256=<hex HMAC-SHA256 of the exact request body>
 * so the receiver can verify authenticity by recomputing over the raw bytes.
 */
export class WebhookMessageRouter implements MessageRouter {
  constructor(
    private readonly url: string,
    private readonly secret: string | undefined,
    private readonly timeoutMs: number,
  ) {}

  async route(message: RoutableMessage): Promise<void> {
    const body = JSON.stringify(message);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.secret) {
      const digest = crypto.createHmac('sha256', this.secret).update(body).digest('hex');
      headers['X-Signature'] = `sha256=${digest}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        // Redacted: status + message id only, never the body.
        logger.error(
          { messageId: message.messageId, status: res.status },
          'Webhook router: non-2xx response',
        );
      }
    } catch (err) {
      // Swallow: a webhook failure/timeout must never break the composite.
      logger.error({ err, messageId: message.messageId }, 'Webhook router: delivery failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
