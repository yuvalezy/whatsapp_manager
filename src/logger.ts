import pino from 'pino';
import { env } from './config/env';

/**
 * Shared structured logger. Pretty-printed in dev, JSON in production.
 * NOTE: message *content* is never logged — only metadata/counters — by design.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});

export type Logger = typeof logger;
