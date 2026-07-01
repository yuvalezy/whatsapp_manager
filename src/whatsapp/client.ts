import { Client, LocalAuth } from 'whatsapp-web.js';
import { env, waWebRemotePath } from '../config/env';
import { logger } from '../logger';
import { registerEvents } from './events';
import { messageRouter } from '../router/message-router';

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

  getClient(): Client | null {
    return this.client;
  }

  getState(): ConnectionState {
    return this.state;
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

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
  }
}

export type { WhatsAppService };
export const whatsappService = new WhatsAppService();
