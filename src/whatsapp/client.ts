import { Client, LocalAuth } from 'whatsapp-web.js';
import { env, waWebRemotePath } from '../config/env';
import { alertService } from '../alerts/alert.service';
import { logger } from '../logger';
import { registerEvents } from './events';
import { reclaimSessionLock } from './session-lock';
import { messageRouter } from '../router/message-router';
import { normalizeNumber } from '../utils/phone';

export type ConnectionState =
  | 'INITIALIZING'
  | 'QR_READY'
  | 'AUTHENTICATED'
  | 'READY'
  | 'DISCONNECTED'
  | 'AUTH_FAILURE'
  | 'ERROR';

export interface WhatsAppStatus {
  state: ConnectionState;
  hasQr: boolean;
  qrGeneratedAt: string | null;
  readyAt: string | null;
  pushname: string | null;
  wid: string | null;
}

/** Auto-reconnect backoff: 5s, 10s, 20s … capped at 5 min, then give up. */
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
const RECONNECT_MAX_ATTEMPTS = 8;

/**
 * Owns the single whatsapp-web.js Client and all connection state.
 * The rest of the app talks to this facade, never to the SDK directly.
 */
class WhatsAppService {
  private client: Client | null = null;
  private state: ConnectionState = 'INITIALIZING';
  private lastQr: string | null = null;
  private qrGeneratedAt: Date | null = null;
  private readyAt: Date | null = null;
  private info: { pushname?: string; wid?: string } = {};
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while a reconnect is actually running, so a second `disconnected`
   * fired inside the `initialize()` window can't stack a concurrent teardown. */
  private reconnecting = false;
  /** Set once `destroy()` runs (app shutdown) so no reconnect fires afterwards. */
  private stopped = false;

  getClient(): Client | null {
    return this.client;
  }

  getState(): ConnectionState {
    return this.state;
  }

  /** This account's own number (digits only), or '' if not linked yet. */
  getOwnNumber(): string {
    return this.info.wid ? normalizeNumber(this.info.wid) : '';
  }

  setState(state: ConnectionState): void {
    this.state = state;
  }

  getLastQr(): string | null {
    return this.lastQr;
  }

  setLastQr(qr: string | null): void {
    this.lastQr = qr;
    this.qrGeneratedAt = qr ? new Date() : null;
  }

  markReady(info: { pushname?: string; wid?: string }): void {
    this.state = 'READY';
    this.readyAt = new Date();
    this.info = info;
    this.lastQr = null;
    // Recovered after an actual outage (not the initial connect) — close the
    // loop for anyone who got a failure alert.
    if (this.reconnectAttempts > 0) {
      alertService.send(
        'WhatsApp Manager recovered',
        `Client is READY again after ${this.reconnectAttempts} reconnect attempt(s).`,
        { tags: ['white_check_mark'] },
      );
    }
    // Reset the backoff and cancel any pending reconnect.
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
  }

  status(): WhatsAppStatus {
    return {
      state: this.state,
      hasQr: this.lastQr !== null,
      qrGeneratedAt: this.qrGeneratedAt?.toISOString() ?? null,
      readyAt: this.readyAt?.toISOString() ?? null,
      pushname: this.info.pushname ?? null,
      wid: this.info.wid ?? null,
    };
  }

  /**
   * Create and start the client. Resolves once initialization *starts*;
   * connection progress is reported asynchronously via events, so the HTTP
   * server (and /qr) stays reachable throughout login.
   */
  async initialize(): Promise<void> {
    // A previous run's browser can outlive its Node process and keep holding the
    // profile, which makes this launch fail (and look like a broken login).
    await reclaimSessionLock();

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: env.WHATSAPP_CLIENT_ID,
        dataPath: env.SESSION_DATA_PATH,
      }),
      // Load a current WhatsApp Web build instead of the stale one the library
      // pins — otherwise WhatsApp rejects linking with "try again later".
      webVersionCache: {
        type: 'remote',
        remotePath: waWebRemotePath(),
      },
      puppeteer: {
        headless: true,
        executablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
    });

    registerEvents(this, this.client, messageRouter);
    logger.info({ waWebVersion: env.WA_WEB_VERSION }, 'Initializing WhatsApp client…');
    await this.client.initialize();
  }

  /**
   * Schedule a reconnect after a `disconnected` event. Capped exponential
   * backoff; gives up after RECONNECT_MAX_ATTEMPTS so a permanently-dead link
   * can't spin forever. A LOGOUT (device unlinked) is terminal — reconnecting
   * would just loop on a fresh QR, so it's left DISCONNECTED for a manual
   * re-link. Idempotent: a pending timer isn't rescheduled.
   */
  scheduleReconnect(reason: string): void {
    if (this.stopped) return;
    if (reason === 'LOGOUT') {
      logger.warn('WhatsApp logged out (device unlinked) — not auto-reconnecting; re-link required');
      alertService.send(
        'WhatsApp Manager logged out',
        'The device was unlinked (LOGOUT). Auto-reconnect will not help — re-scan the QR to re-link.',
        { priority: 'urgent', tags: ['rotating_light'] },
      );
      return;
    }
    if (this.reconnectTimer) return; // already scheduled
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      logger.error(
        { attempts: this.reconnectAttempts },
        'WhatsApp reconnect gave up after max attempts — manual restart required',
      );
      alertService.send(
        'WhatsApp Manager is DOWN',
        `Reconnect gave up after ${this.reconnectAttempts} attempts (last reason: ${reason}). Manual restart required — message capture is stopped.`,
        { priority: 'urgent', tags: ['rotating_light'] },
      );
      return;
    }
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_MS);
    this.reconnectAttempts += 1;
    logger.warn(
      { reason, attempt: this.reconnectAttempts, delayMs: delay },
      'Scheduling WhatsApp reconnect',
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Tear down the dead client and start a fresh session (LocalAuth restores it). */
  private async reconnect(): Promise<void> {
    if (this.stopped || this.reconnecting) return;
    this.reconnecting = true;
    logger.info({ attempt: this.reconnectAttempts }, 'Reconnecting WhatsApp client…');
    this.state = 'INITIALIZING';
    try {
      await this.teardownClient();
      await this.initialize();
    } catch (err) {
      logger.error({ err }, 'WhatsApp reconnect failed to initialize; will retry');
      this.scheduleReconnect('reconnect-error');
    } finally {
      this.reconnecting = false;
    }
  }

  /** Best-effort teardown that never throws (the browser may already be gone). */
  private async teardownClient(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.destroy();
    } catch (err) {
      logger.warn({ err }, 'Error tearing down WhatsApp client before reconnect (ignored)');
    } finally {
      this.client = null;
    }
  }

  async destroy(): Promise<void> {
    this.stopped = true;
    this.clearReconnectTimer();
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
  }
}

export type { WhatsAppService };
export const whatsappService = new WhatsAppService();
