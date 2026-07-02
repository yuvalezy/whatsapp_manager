import 'dotenv/config';
import { z } from 'zod';

/**
 * Parse booleans explicitly. `z.coerce.boolean()` treats any non-empty
 * string as `true` (so "false" -> true), which is a footgun for feature flags.
 */
const boolFlag = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v.trim() === '') return def;
      return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
    });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // Database — DATABASE_URL wins when present, otherwise discrete PG* vars.
  DATABASE_URL: z.string().optional(),
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().int().positive().default(5432),
  PGUSER: z.string().default('postgres'),
  PGPASSWORD: z.string().default('postgres'),
  PGDATABASE: z.string().default('whatsapp_manager'),

  // WhatsApp
  WHATSAPP_CLIENT_ID: z.string().default('personal-monitor'),
  SESSION_DATA_PATH: z.string().default('./.wwebjs_auth'),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  MONITOR_GROUPS: boolFlag(false),

  // WhatsApp Web version. The library pins an old build that WhatsApp now
  // rejects at link time ("Couldn't link device, try again later"). We load a
  // current build from wppconnect/wa-version instead. Bump WA_WEB_VERSION when
  // it eventually goes stale, or set WA_WEB_VERSION_REMOTE_PATH to a full URL.
  WA_WEB_VERSION: z.string().default('2.3000.1042470511-alpha'),
  WA_WEB_VERSION_REMOTE_PATH: z.string().optional(),

  // Safety
  ENABLE_OUTBOUND: boolFlag(false),
  OUTBOUND_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  OUTBOUND_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // API auth (optional)
  API_KEY: z.string().optional(),

  // ── Encrypted credentials store ──────────────────────────────
  // Master key for AES-256-GCM at-rest encryption of provider API keys.
  // base64 32 bytes: `openssl rand -base64 32`. Unset ⇒ store disabled.
  CREDENTIALS_ENCRYPTION_KEY: z.string().optional(),

  // ── AI providers (keys live in the encrypted store; these env vars
  //    are an optional bootstrap fallback only) ──────────────────
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),

  // Models. TRANSLATION_MODEL is the exact DeepSeek API model string.
  TRANSCRIPTION_MODEL: z.string().default('gpt-4o-transcribe'),
  TRANSLATION_MODEL: z.string().default('deepseek-chat'),
  TARGET_LANGUAGE: z.string().default('en'),

  // ── Media archival ───────────────────────────────────────────
  MEDIA_STORAGE_PATH: z.string().default('./media'),
  MEDIA_MAX_BYTES: z.coerce.number().int().nonnegative().default(0), // 0 = unlimited

  // ── Transcription worker ─────────────────────────────────────
  ENABLE_TRANSCRIPTION: boolFlag(false),
  TRANSCRIPTION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  TRANSCRIPTION_BATCH: z.coerce.number().int().positive().default(5),

  // ── History backfill ─────────────────────────────────────────
  // Per-chat cap for fetchMessages. 0 = Infinity (all locally-available).
  BACKFILL_LIMIT_PER_CHAT: z.coerce.number().int().nonnegative().default(1000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment configuration:\n',
    JSON.stringify(
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      null,
      2,
    ),
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

/** Full URL of the WhatsApp Web build to load (remote webVersionCache). */
export function waWebRemotePath(): string {
  if (env.WA_WEB_VERSION_REMOTE_PATH && env.WA_WEB_VERSION_REMOTE_PATH.trim() !== '') {
    return env.WA_WEB_VERSION_REMOTE_PATH;
  }
  return `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${env.WA_WEB_VERSION}.html`;
}

/** Build a libpq connection string from the resolved config. */
export function databaseUrl(): string {
  if (env.DATABASE_URL && env.DATABASE_URL.trim() !== '') return env.DATABASE_URL;
  const { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } = env;
  return `postgres://${PGUSER}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT}/${PGDATABASE}`;
}
