import { env } from '../config/env';
import { logger } from '../logger';
import { whatsappService } from '../whatsapp/client';
import { whitelistService } from '../whitelist/whitelist.service';
import { groupService } from '../groups/group.service';
import { messageService } from '../messages/message.service';
import { buildRoutable } from '../whatsapp/message-mapper';
import { resolveContactNumber } from '../whatsapp/lid-resolver';
import { SKIP_TYPES } from '../whatsapp/message-types';
import { normalizeNumber, toChatId, toGroupChatId } from '../utils/phone';

export interface BackfillStatus {
  running: boolean;
  processed: number;
  saved: number;
  startedAt: string | null;
  finishedAt: string | null;
  currentNumber: string | null;
  error: string | null;
}

/**
 * Pulls conversation history for whitelisted contacts via
 * `chat.fetchMessages()` and feeds it through the same media-download + save
 * pipeline as live ingestion. Manual-trigger only. One run at a time; progress
 * is exposed via getStatus(). History depth is bounded by whatever WhatsApp has
 * synced to this linked device (see README).
 */
class BackfillService {
  private status: BackfillStatus = {
    running: false,
    processed: 0,
    saved: 0,
    startedAt: null,
    finishedAt: null,
    currentNumber: null,
    error: null,
  };

  getStatus(): BackfillStatus {
    return { ...this.status };
  }

  /** Backfill one whitelisted number within an optional date window. Returns saved count. */
  async backfillNumber(rawNumber: string, opts: { since?: number; until?: number } = {}): Promise<number> {
    const client = whatsappService.getClient();
    if (!client || whatsappService.getState() !== 'READY') {
      throw new Error('WhatsApp client is not ready');
    }
    const number = normalizeNumber(rawNumber);
    this.status.currentNumber = number;
    const ownNumber = whatsappService.getOwnNumber();

    const chat = await client.getChatById(toChatId(number));
    if (!chat) throw new Error(`No chat found for ${number}`);

    // Best-effort: ask WhatsApp to sync older server-side history first.
    try {
      await chat.syncHistory();
    } catch {
      /* best effort — may be a no-op when history transfer is already complete */
    }

    const limit = env.BACKFILL_LIMIT_PER_CHAT > 0 ? env.BACKFILL_LIMIT_PER_CHAT : Infinity;
    const messages = await chat.fetchMessages({ limit });

    let saved = 0;
    for (const message of messages) {
      const ts = message.timestamp * 1000; // Unix seconds → ms
      if (opts.since !== undefined && ts < opts.since) continue;
      if (opts.until !== undefined && ts > opts.until) continue;
      if (SKIP_TYPES.has(String(message.type))) continue;

      this.status.processed += 1;
      try {
        // Pin to the chat we're backfilling (fetched messages may be LID-addressed).
        const routable = await buildRoutable(message, ownNumber, number);
        const inserted = await messageService.save(routable);
        if (inserted) {
          saved += 1;
          this.status.saved += 1;
        }
      } catch (err) {
        logger.error({ err, messageId: message.id?._serialized }, 'Backfill: failed to store message');
      }
    }
    logger.info({ number, fetched: messages.length, saved }, 'Backfill complete for number');
    return saved;
  }

  /**
   * Backfill one monitored group within an optional date window. Mirrors
   * `backfillNumber` but keys the thread by the group id and resolves the real
   * author per message (so every member's history is attributed correctly),
   * exactly like live group ingestion. Returns saved count.
   */
  async backfillGroup(rawGroupId: string, opts: { since?: number; until?: number } = {}): Promise<number> {
    const client = whatsappService.getClient();
    if (!client || whatsappService.getState() !== 'READY') {
      throw new Error('WhatsApp client is not ready');
    }
    const groupId = normalizeNumber(rawGroupId);
    this.status.currentNumber = groupId;
    const ownNumber = whatsappService.getOwnNumber();

    const chat = await client.getChatById(toGroupChatId(groupId));
    if (!chat) throw new Error(`No group chat found for ${groupId}`);

    // Best-effort: ask WhatsApp to sync older server-side history first.
    try {
      await chat.syncHistory();
    } catch {
      /* best effort — may be a no-op when history transfer is already complete */
    }

    const limit = env.BACKFILL_LIMIT_PER_CHAT > 0 ? env.BACKFILL_LIMIT_PER_CHAT : Infinity;
    const messages = await chat.fetchMessages({ limit });

    let saved = 0;
    for (const message of messages) {
      const ts = message.timestamp * 1000; // Unix seconds → ms
      if (opts.since !== undefined && ts < opts.since) continue;
      if (opts.until !== undefined && ts > opts.until) continue;
      if (SKIP_TYPES.has(String(message.type))) continue;

      this.status.processed += 1;
      try {
        // Thread key = group id; resolve the real author for per-message attribution.
        const authorNumber = message.id.fromMe
          ? ownNumber
          : await resolveContactNumber(client, message.author ?? message.from ?? '');
        const routable = await buildRoutable(message, ownNumber, groupId, authorNumber);
        const inserted = await messageService.save(routable);
        if (inserted) {
          saved += 1;
          this.status.saved += 1;
        }
      } catch (err) {
        logger.error({ err, messageId: message.id?._serialized }, 'Backfill: failed to store group message');
      }
    }
    logger.info({ groupId, fetched: messages.length, saved }, 'Backfill complete for group');
    return saved;
  }

  /** Backfill every whitelisted number, then every monitored group. */
  async backfillAll(opts: { since?: number; until?: number } = {}): Promise<void> {
    const numbers = (await whitelistService.list()).map((e) => e.phone_number);
    for (const number of numbers) {
      try {
        await this.backfillNumber(number, opts);
      } catch (err) {
        logger.error({ err, number }, 'Backfill failed for number');
      }
    }
    const groups = await groupService.list();
    for (const g of groups) {
      try {
        await this.backfillGroup(g.group_id, opts);
      } catch (err) {
        logger.error({ err, groupId: g.group_id }, 'Backfill failed for group');
      }
    }
  }

  /**
   * Auto-run on every WhatsApp reconnect: for each whitelisted contact, backfill
   * from that contact's own last-known message timestamp (no separate "last run"
   * state needed — it's derived from the messages already stored). Closes any gap
   * left by downtime. Contacts with no captured messages yet are skipped — that's
   * an initial backfill, left to a manual trigger. No-ops if a backfill (manual or
   * auto) is already running.
   */
  async catchUpAll(): Promise<void> {
    if (this.status.running) {
      logger.info('Skipping auto catch-up backfill — a backfill is already running');
      return;
    }
    this.status = {
      running: true,
      processed: 0,
      saved: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      currentNumber: null,
      error: null,
    };

    try {
      const numbers = (await whitelistService.list()).map((e) => e.phone_number);
      for (const number of numbers) {
        const since = await messageService.getLastMessageTimestamp(number);
        if (since === null) continue;
        try {
          await this.backfillNumber(number, { since });
        } catch (err) {
          logger.error({ err, number }, 'Auto catch-up failed for number');
        }
      }
      const groups = await groupService.list();
      for (const g of groups) {
        const since = await messageService.getLastMessageTimestamp(g.group_id);
        if (since === null) continue;
        try {
          await this.backfillGroup(g.group_id, { since });
        } catch (err) {
          logger.error({ err, groupId: g.group_id }, 'Auto catch-up failed for group');
        }
      }
    } catch (err) {
      this.status.error = err instanceof Error ? err.message : String(err);
      logger.error({ err }, 'Auto catch-up run failed');
    } finally {
      this.status.running = false;
      this.status.finishedAt = new Date().toISOString();
      this.status.currentNumber = null;
    }
  }

  /** Kick off a backfill in the background. Returns immediately (one run at a time). */
  start(target: { number?: string; groupId?: string; since?: number; until?: number }): void {
    if (this.status.running) return;
    this.status = {
      running: true,
      processed: 0,
      saved: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      currentNumber: target.number ?? target.groupId ?? null,
      error: null,
    };

    const run = target.groupId
      ? this.backfillGroup(target.groupId, { since: target.since, until: target.until }).then(
          () => undefined,
        )
      : target.number
        ? this.backfillNumber(target.number, { since: target.since, until: target.until }).then(
            () => undefined,
          )
        : this.backfillAll({ since: target.since, until: target.until });

    run
      .catch((err) => {
        this.status.error = err instanceof Error ? err.message : String(err);
        logger.error({ err }, 'Backfill run failed');
      })
      .finally(() => {
        this.status.running = false;
        this.status.finishedAt = new Date().toISOString();
        this.status.currentNumber = null;
      });
  }
}

export const backfillService = new BackfillService();
