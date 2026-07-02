import { query } from '../db';
import { env } from '../config/env';
import { logger } from '../logger';
import { encrypt, decrypt, isEncryptionConfigured, SealedSecret } from '../crypto/secret-box';

/** Safe, non-secret view of a stored credential. */
export interface CredentialSummary {
  name: string;
  last4: string | null;
  updated_at: string;
}

/**
 * Encrypted-at-rest store for provider API keys (openai, deepseek, …).
 * Owns all SQL for the `credentials` table. Plaintext values live only in an
 * in-memory cache (loaded/decrypted at startup) and are never logged or
 * returned by the API — callers get `last4` for masked display only.
 */
class CredentialsService {
  private cache = new Map<string, string>(); // name -> plaintext

  /** Decrypt every stored credential into memory. Call once at startup. */
  async load(): Promise<void> {
    if (!isEncryptionConfigured()) {
      logger.warn(
        'CREDENTIALS_ENCRYPTION_KEY not set — encrypted credentials store disabled (env fallback only).',
      );
      return;
    }
    const { rows } = await query<{
      name: string;
      ciphertext: Buffer;
      iv: Buffer;
      auth_tag: Buffer;
    }>('SELECT name, ciphertext, iv, auth_tag FROM credentials');

    this.cache.clear();
    let failures = 0;
    for (const r of rows) {
      try {
        this.cache.set(r.name, decrypt({ ciphertext: r.ciphertext, iv: r.iv, authTag: r.auth_tag }));
      } catch {
        failures += 1;
        logger.error({ name: r.name }, 'Failed to decrypt credential (wrong master key?)');
      }
    }
    logger.info({ count: this.cache.size, failures }, 'Credentials loaded');
  }

  /** Whether the store is usable (a master key is configured). */
  enabled(): boolean {
    return isEncryptionConfigured();
  }

  /** Plaintext value from the in-memory cache, or `undefined`. */
  get(name: string): string | undefined {
    return this.cache.get(name);
  }

  has(name: string): boolean {
    return (this.cache.get(name)?.length ?? 0) > 0;
  }

  async list(): Promise<CredentialSummary[]> {
    const { rows } = await query<CredentialSummary>(
      'SELECT name, last4, updated_at FROM credentials ORDER BY name ASC',
    );
    return rows;
  }

  async set(name: string, value: string): Promise<CredentialSummary> {
    if (!isEncryptionConfigured()) {
      throw new Error(
        'Encrypted credentials store is disabled (CREDENTIALS_ENCRYPTION_KEY not set).',
      );
    }
    const sealed: SealedSecret = encrypt(value);
    const last4 = value.slice(-4);
    const { rows } = await query<CredentialSummary>(
      `INSERT INTO credentials (name, ciphertext, iv, auth_tag, last4, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (name) DO UPDATE
         SET ciphertext = EXCLUDED.ciphertext,
             iv         = EXCLUDED.iv,
             auth_tag   = EXCLUDED.auth_tag,
             last4      = EXCLUDED.last4,
             updated_at = now()
       RETURNING name, last4, updated_at`,
      [name, sealed.ciphertext, sealed.iv, sealed.authTag, last4],
    );
    this.cache.set(name, value);
    logger.info({ name }, 'Credential stored'); // value is never logged
    return rows[0];
  }

  async remove(name: string): Promise<boolean> {
    const { rowCount } = await query('DELETE FROM credentials WHERE name = $1', [name]);
    this.cache.delete(name);
    const removed = (rowCount ?? 0) > 0;
    if (removed) logger.info({ name }, 'Credential removed');
    return removed;
  }
}

export const credentialsService = new CredentialsService();

// ── Provider key resolvers: encrypted store wins, env is bootstrap fallback ──
export function resolveOpenAiKey(): string | undefined {
  return credentialsService.get('openai') ?? (env.OPENAI_API_KEY || undefined);
}

export function resolveDeepseekKey(): string | undefined {
  return credentialsService.get('deepseek') ?? (env.DEEPSEEK_API_KEY || undefined);
}
