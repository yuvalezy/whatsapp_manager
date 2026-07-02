import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './logger';
import { runMigrations } from './db/migrate';
import { closePool, query } from './db';
import { whitelistService } from './whitelist/whitelist.service';
import { whitelistRouter } from './whitelist/whitelist.routes';
import { groupService } from './groups/group.service';
import { groupsRouter } from './groups/group.routes';
import { messagesRouter } from './messages/message.routes';
import { whatsappRouter } from './whatsapp/whatsapp.routes';
import { outboundRouter } from './outbound/outbound.routes';
import { credentialsRouter } from './credentials/credentials.routes';
import { credentialsService } from './credentials/credentials.service';
import { backfillRouter } from './backfill/backfill.routes';
import { costsRouter } from './costs/cost.routes';
import { ezyPortalRouter } from './ezy-portal/ezy-portal.routes';
import { authRouter } from './auth/auth.routes';
import { authGuard } from './auth/auth.middleware';
import { runTranscriptionPass } from './enrichment/worker';
import { whatsappService } from './whatsapp/client';
import { ignoredStats } from './messages/ignored-stats';
import { messageService } from './messages/message.service';
import { sseManager } from './sse';
import { buildStatusData } from './whatsapp/whatsapp.routes';

const IGNORED_FLUSH_INTERVAL_MS = 30_000;

function buildApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false })); // inline QR data-url image
  app.use(express.json({ limit: '256kb' }));

  // Public health check (no auth) — useful for Docker/K8s probes.
  // Probes Postgres with a bare `SELECT 1` (bounded by a short timeout so a
  // black-holed DB can't hang the probe) and reports 503 when the DB is down,
  // so a dead database no longer returns a healthy 200.
  app.get('/health', async (_req, res) => {
    let dbOk = false;
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        query('SELECT 1'),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('DB health probe timed out')), 2000);
        }),
      ]);
      dbOk = true;
    } catch (err) {
      logger.error({ err }, 'Health check DB probe failed');
    } finally {
      if (timer) clearTimeout(timer);
    }
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      state: whatsappService.getState(),
      db: dbOk ? 'ok' : 'down',
    });
  });

  // Public: personal login (issues a forever-JWT). Rate-limited inside the router.
  app.use('/auth', authRouter);

  // Everything below requires a credential when auth is configured:
  //   • personal JWT (Bearer / ?access_token=) → full access
  //   • external API_KEY (x-api-key / ?api_key=) → read-only (GET)
  app.use(authGuard);

  // Confirm the caller's token is still valid (used by the frontend on boot).
  app.get('/auth/me', (req, res) => {
    res.json({
      data: {
        authenticated: true,
        kind: req.auth?.kind ?? 'user',
        username: req.auth?.sub ?? null,
      },
    });
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'whatsapp-manager',
      endpoints: [
        'GET /health',
        'POST /auth/login',
        'GET /auth/me',
        'GET /qr',
        'GET /status',
        'GET /contacts',
        'GET /whitelist',
        'POST /whitelist',
        'PUT /whitelist/:id',
        'DELETE /whitelist/:number',
        'GET /groups',
        'GET /groups/available',
        'POST /groups',
        'PUT /groups/:id/ezy-link',
        'DELETE /groups/:groupId',
        'GET /messages',
        'GET /messages/threads',
        'GET /messages/:number',
        'POST /messages/:id/translate',
        'POST /messages/:number/translate-all',
        'GET /messages/:id/media',
        'POST /backfill',
        'POST /backfill/:number',
        'POST /backfill/group/:groupId',
        'GET /backfill/status',
        'GET /credentials',
        'PUT /credentials/:name',
        'DELETE /credentials/:name',
        'GET /costs',
        'GET /costs/summary',
        'GET /costs/daily',
      ],
    });
  });

  app.use('/', whatsappRouter); // /qr, /status
  app.use('/whitelist', whitelistRouter);
  app.use('/groups', groupsRouter);
  app.use('/messages', messagesRouter);
  app.use('/outbound', outboundRouter);
  app.use('/credentials', credentialsRouter);
  app.use('/backfill', backfillRouter);
  app.use('/costs', costsRouter);
  app.use('/ezy-portal', ezyPortalRouter);

  // SSE event stream — push messages and status changes to connected clients.
  app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseManager.addClient(res);

    req.on('close', () => sseManager.removeClient(res));
    req.on('error', () => sseManager.removeClient(res));
  });

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Centralized error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled route error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function flushIgnored(): Promise<void> {
  const deltas = ignoredStats.pendingDeltas();
  for (const { reason, delta } of deltas) {
    try {
      await messageService.addIgnored(reason, delta);
    } catch (err) {
      logger.error({ err, reason }, 'Failed to persist ignored counter');
    }
  }
}

async function main(): Promise<void> {
  await runMigrations();
  await whitelistService.load();
  await groupService.load();
  await credentialsService.load();

  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`HTTP server listening on http://localhost:${env.PORT}`);
    logger.info(`Scan the QR at   → http://localhost:${env.PORT}/qr`);
  });

  // Start WhatsApp in the background so /qr is reachable during login.
  whatsappService.initialize().catch((err) => {
    whatsappService.setState('ERROR');
    logger.error({ err }, 'WhatsApp client failed to initialize (API still available)');
  });

  const flushTimer = setInterval(() => {
    void flushIgnored().then(() => {
      sseManager.broadcast('status', buildStatusData());
    });
  }, IGNORED_FLUSH_INTERVAL_MS);
  flushTimer.unref();

  // Background transcription worker (gated by ENABLE_TRANSCRIPTION + OpenAI key).
  const transcriptionTimer = setInterval(() => {
    void runTranscriptionPass().catch((err) =>
      logger.error({ err }, 'Transcription pass failed'),
    );
  }, env.TRANSCRIPTION_POLL_INTERVAL_MS);
  transcriptionTimer.unref();

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down…');
    clearInterval(flushTimer);
    clearInterval(transcriptionTimer);
    await flushIgnored();
    server.close();
    try {
      await whatsappService.destroy();
    } catch (err) {
      logger.warn({ err }, 'Error while destroying WhatsApp client');
    }
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
