import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * Tiny authenticated-encryption helper for credentials at rest.
 *
 * AES-256-GCM with a random 12-byte IV per write and a 16-byte auth tag.
 * The 32-byte key is derived from `CREDENTIALS_ENCRYPTION_KEY` via scrypt with
 * a fixed app salt. Plaintext secrets are only ever held in memory — never
 * written to disk or the DB in the clear.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const KEY_SALT = 'whatsapp-manager:credentials:v1';

let cachedKey: Buffer | null = null;

/** True when a master key is configured (the credentials store is usable). */
export function isEncryptionConfigured(): boolean {
  return Boolean(env.CREDENTIALS_ENCRYPTION_KEY && env.CREDENTIALS_ENCRYPTION_KEY.trim() !== '');
}

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (!isEncryptionConfigured()) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is not set — the encrypted credentials store is disabled.',
    );
  }
  cachedKey = crypto.scryptSync(env.CREDENTIALS_ENCRYPTION_KEY as string, KEY_SALT, KEY_BYTES);
  return cachedKey;
}

export interface SealedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/** Encrypt a plaintext secret. Throws if no master key is configured. */
export function encrypt(plaintext: string): SealedSecret {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

/** Decrypt a sealed secret. Throws on tamper (GCM verification failure). */
export function decrypt(sealed: SealedSecret): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey(), sealed.iv);
  decipher.setAuthTag(sealed.authTag);
  const plain = Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
  return plain.toString('utf8');
}
