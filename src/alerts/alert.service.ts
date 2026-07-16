import { env } from '../config/env';
import { logger } from '../logger';

export type AlertPriority = 'default' | 'high' | 'urgent';

/**
 * Pushes ops alerts for the connection states the service cannot recover from
 * on its own (and recoveries after an outage). WhatsApp itself is the dead
 * channel in every one of those states and browser notifications need an open
 * dashboard tab, so this is the one signal that still reaches the owner.
 *
 * Transport is a plain-text POST with ntfy-style headers (Title / Priority /
 * Tags) — point ALERT_WEBHOOK_URL at an ntfy.sh topic and it renders natively;
 * any webhook that accepts a text body works too. Unset ⇒ no-op.
 *
 * Best-effort by contract: send() never throws and never blocks the caller —
 * alerting must not be able to break the reconnect path it reports on.
 */
class AlertService {
  available(): boolean {
    return Boolean(env.ALERT_WEBHOOK_URL);
  }

  send(title: string, message: string, opts?: { priority?: AlertPriority; tags?: string[] }): void {
    if (!env.ALERT_WEBHOOK_URL) return;
    const url = env.ALERT_WEBHOOK_URL;
    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Title: title,
        Priority: opts?.priority ?? 'default',
        ...(opts?.tags?.length ? { Tags: opts.tags.join(',') } : {}),
      },
      body: message,
      signal: AbortSignal.timeout(env.ALERT_WEBHOOK_TIMEOUT_MS),
    })
      .then((res) => {
        if (!res.ok) logger.warn({ status: res.status, title }, 'Alert webhook responded non-2xx');
      })
      .catch((err) => logger.warn({ err, title }, 'Alert webhook delivery failed'));
  }
}

export const alertService = new AlertService();
