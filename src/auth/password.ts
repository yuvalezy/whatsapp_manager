import crypto from 'node:crypto';

/**
 * scrypt password hashing — no dependency (mirrors crypto/secret-box.ts).
 * Stored format: `scrypt$<saltBase64>$<hashBase64>`. Generate a hash for the
 * env var with `npm run hash-password -- <password>`.
 */
const KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Constant-time verify of a password against a stored `scrypt$salt$hash`. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], 'base64');
    expected = Buffer.from(parts[2], 'base64');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
