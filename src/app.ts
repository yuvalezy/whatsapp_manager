import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './logger';
import { runMigrations } from './db/migrate';
import { closePool } from './db';
import { whitelistService } from './whitelist/whitelist.service';
import { whitelistRouter } from './whitelist/whitelist.routes';
import { messagesRouter } from './messages/message.routes';
import { whatsappRouter } from './whatsapp/whatsapp.routes';
import { outboundRouter } from './outbound/outbound.routes';
import { credentialsRouter } from './credentials/credentials.routes';
import { credentialsService } from './credentials/credentials.service';
import { backfillRouter } from './backfill/backfill.routes';
import { costsRouter } from './costs/cost.routes';
import { runTranscriptionPass } from './enrichment/worker';
import { whatsappService } from './whatsapp/client';
import { ignoredStats } from './messages/ignored-stats';
import { messageService } from './messages/message.service';

const IGNORED_FLUSH_INTERVAL_MS = 30_000;

/** Optional shared-secret guard. Disabled when API_KEY is unset. */
function apiKeyGuard(req: Request, res: Response, next: NextFunction): void {
  if (!env.API_KEY) {
    next();
    return;
  }
  const provided = req.headers['x-api-key'] ?? req.query.api_key;
  if (provided === env.API_KEY) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function buildApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false })); // inline QR data-url image
  app.use(express.json({ limit: '256kb' }));

  // Public health check (no auth) — useful for Docker/K8s probes.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), state: whatsappService.getState() });
  });

  // Everything below may require the API key (if configured).
  app.use(apiKeyGuard);

  app.get('/', (_req, res) => {
    res.json({
      service: 'whatsapp-manager',
      endpoints: [
        'GET /health',
        'GET /qr',
        'GET /status',
        'GET /whitelist',
        'POST /whitelist',
        'DELETE /whitelist/:number',
        'GET /messages',
        'GET /messages/threads',
        'GET /messages/:number',
        'POST /messages/:id/translate',
        'POST /messages/:number/translate-all',
        'GET /messages/:id/media',
        'POST /backfill',
        'POST /backfill/:number',
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
  app.use('/messages', messagesRouter);
  app.use('/outbound', outboundRouter);
  app.use('/credentials', credentialsRouter);
  app.use('/backfill', backfillRouter);
  app.use('/costs', costsRouter);

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
    void flushIgnored();
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
