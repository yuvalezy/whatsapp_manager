import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * Hand-rolled HS256 JWT — no dependency, mirrors the crypto/secret-box.ts style.
 *
 * Tokens carry NO expiry by design: the personal login is meant to last
 * "forever" until the user logs out or JWT_SECRET is rotated. We always verify
 * with HMAC-SHA256 and ignore the token's own `alg` header, so the classic
 * `alg:none` forgery does not apply.
 */

export interface JwtPayload {
  sub: string; // username
  iat: number; // issued-at (unix seconds)
  [k: string]: unknown;
}

/** True when personal-login JWTs can be signed/verified. */
export function isAuthConfigured(): boolean {
  return Boolean(env.JWT_SECRET && env.JWT_SECRET.trim() !== '');
}

function secret(): string {
  const s = env.JWT_SECRET;
  if (!s || s.trim() === '') {
    throw new Error('JWT_SECRET is not set — personal login is disabled.');
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signature(headerAndPayload: string): string {
  return crypto.createHmac('sha256', secret()).update(headerAndPayload).digest('base64url');
}

/** Sign a forever-token for the given subject (username). */
export function sign(payload: { sub: string } & Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000), ...payload }));
  const data = `${header}.${body}`;
  return `${data}.${signature(data)}`;
}

/** Verify a token's signature and return its payload, or null when invalid. */
export function verify(token: string): JwtPayload | null {
  if (!isAuthConfigured()) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = signature(`${header}.${body}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
  } catch {
    return null;
  }
}
