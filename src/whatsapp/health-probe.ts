import type { Page } from 'puppeteer';
import { env } from '../config/env';
import { logger } from '../logger';
import { whatsappService } from './client';
import { sseManager } from '../sse';
import { buildStatusData } from './whatsapp.routes';

/**
 * Liveness probe for the READY client.
 *
 * The SDK only emits `disconnected` when WhatsApp itself signals a logout. The
 * browser page backing the client can die *without* that event — it happened on
 * 2026-07-16: the page's main frame detached under a still-running Chrome, and
 * every call (sendMessage, sendSeen, getChats) threw "Attempted to use detached
 * Frame" for ~5 hours while `/status` happily reported READY. Nothing recovered
 * it, and outbound sends 500'd instead of getting the route's clean 503, because
 * the guard there trusts `getState() === 'READY'`.
 *
 * So: verify the page can still execute, and if it can't, route the failure into
 * the same recovery path a real `disconnected` uses. This only ever *demotes* a
 * READY client — it never marks one ready.
 */

/** A hung renderer must not stall the probe forever. */
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Consecutive failures before we tear a session down. A reconnect costs a browser
 * relaunch and ~30s of downtime, so one blip (GC pause, loaded machine) must not
 * trigger it — but a genuinely dead page fails every probe, so it still gets
 * caught within FAILURE_THRESHOLD ticks.
 */
const FAILURE_THRESHOLD = 2;

let consecutiveFailures = 0;
let inFlight = false;

/**
 * One probe pass. Called from a timer in app.ts, mirroring `flushIgnored` /
 * `runTranscriptionPass`.
 */
export async function runHealthProbe(): Promise<void> {
  if (!env.ENABLE_HEALTH_PROBE) return;

  // Only READY makes a claim worth checking. Every other state is already owned
  // by the reconnect machinery (or is a terminal LOGOUT / AUTH_FAILURE), so a
  // probe there would either race it or spam a dead link.
  if (whatsappService.getState() !== 'READY') {
    consecutiveFailures = 0;
    return;
  }
  if (inFlight) return; // a slow probe must not stack on the next tick

  const page = whatsappService.getClient()?.pupPage;
  if (!page) {
    // READY with no page is itself broken state, but it's not this probe's call
    // to make — there's nothing to execute against, so leave it to the reconnect
    // path and don't count it as a page failure.
    return;
  }

  inFlight = true;
  try {
    const alive = await probeOnce(page);
    if (alive) {
      consecutiveFailures = 0;
      return;
    }
    // Page executes but the SDK's injection is gone — i.e. WhatsApp Web reloaded
    // itself out from under us. Every Store-backed call would fail.
    recordFailure('whatsapp-web.js injection missing (page reloaded?)');
  } catch (err) {
    // The page can't execute at all: detached frame, closed target, dead browser.
    recordFailure(err instanceof Error ? err.message : String(err));
  } finally {
    inFlight = false;
  }
}

/**
 * Ask the page whether the SDK's injected helpers are still there. Deliberately
 * reuses the library's *own* liveness check (`Client.js` gates its injection on
 * exactly this expression) rather than reaching into WhatsApp internals, whose
 * shape changes with every WA Web build.
 *
 * Both outcomes are meaningful: a throw means the page is gone, `false` means the
 * page reloaded and lost the injection.
 */
async function probeOnce(page: Page): Promise<boolean> {
  // `globalThis` is the page's `window` here; the backend has no DOM lib, so it
  // is also the only spelling that typechecks.
  const evaluation = page.evaluate(
    () => typeof (globalThis as unknown as { WWebJS?: unknown }).WWebJS !== 'undefined',
  );
  // The race's loser stays pending — attach a handler now so a late rejection
  // from a timed-out evaluate can't surface as an unhandled rejection.
  evaluation.catch(() => undefined);

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      evaluation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('health probe timed out')), PROBE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Count a failed probe and, at the threshold, demote the client into the normal
 * reconnect path (capped backoff, LOGOUT-aware) — the same one `disconnected`
 * uses, so recovery stays in one place.
 */
function recordFailure(reason: string): void {
  // A real `disconnected` may have landed while we were awaiting; it already owns
  // the recovery, so don't pile a second teardown onto it.
  if (whatsappService.getState() !== 'READY') {
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures += 1;
  if (consecutiveFailures < FAILURE_THRESHOLD) {
    logger.warn(
      { reason, failures: consecutiveFailures, threshold: FAILURE_THRESHOLD },
      'WhatsApp health probe failed — retrying before acting',
    );
    return;
  }

  logger.error(
    { reason, failures: consecutiveFailures },
    'WhatsApp page is dead while state said READY — forcing reconnect',
  );
  consecutiveFailures = 0;
  whatsappService.setState('DISCONNECTED');
  sseManager.broadcast('status', buildStatusData());
  whatsappService.scheduleReconnect('health-probe');
}
