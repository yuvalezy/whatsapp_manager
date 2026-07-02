import type { Response } from 'express';
import { logger } from '../logger';

class SseManager {
  private clients = new Set<Response>();
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  addClient(res: Response): void {
    this.clients.add(res);
    logger.debug({ count: this.clients.size }, 'SSE client connected');
    if (!this.keepaliveTimer) {
      this.startKeepalive();
    }
  }

  removeClient(res: Response): void {
    this.clients.delete(res);
    logger.debug({ count: this.clients.size }, 'SSE client disconnected');
    if (this.clients.size === 0 && this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  broadcast(type: string, data: unknown): void {
    if (this.clients.size === 0) return;
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.removeClient(client);
      }
    }
  }

  private startKeepalive(): void {
    this.keepaliveTimer = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.write(': keepalive\n\n');
        } catch {
          this.removeClient(client);
        }
      }
    }, 15_000);
  }
}

export const sseManager = new SseManager();
