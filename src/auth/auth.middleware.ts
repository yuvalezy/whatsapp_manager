import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { isAuthConfigured, verify } from './jwt';

/**
 * The single app-wide guard. Three credentials, three capability levels:
 *   • personal JWT   (Authorization: Bearer <jwt>  /  ?access_token=)  → full access
 *   • external key   (x-api-key: <key>             /  ?api_key=)       → read-only (GET)
 *   • outbound key   (x-api-key: <OUTBOUND_API_KEY>)                   → POST /outbound/send ONLY
 *
 * The query-param variants exist because element/navigation/SSE requests
 * (<img>, <audio>, <a download>, EventSource) can't set headers.
 *
 * When neither JWT_SECRET nor API_KEY is configured the API is OPEN (local dev),
 * mirroring the previous optional guard. The API key is read-only ONLY when a
 * personal login exists to hold full access — without one it is the sole
 * credential and keeps full access (backward-compatible).
 */

export type AuthKind = 'user' | 'apikey';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { kind: AuthKind; sub?: string };
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  const q = req.query.access_token;
  return typeof q === 'string' && q !== '' ? q : null;
}

function apiKey(req: Request): string | null {
  const h = req.headers['x-api-key'];
  if (typeof h === 'string' && h !== '') return h;
  const q = req.query.api_key;
  return typeof q === 'string' && q !== '' ? q : null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function isReadMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const hasApiKey = Boolean(env.API_KEY && env.API_KEY.trim() !== '');

  // Nothing configured → open (local dev).
  if (!isAuthConfigured() && !hasApiKey) {
    req.auth = { kind: 'user' };
    next();
    return;
  }

  // 1) Personal JWT → full access.
  const token = bearerToken(req);
  if (token) {
    const payload = verify(token);
    if (payload) {
      req.auth = { kind: 'user', sub: typeof payload.sub === 'string' ? payload.sub : undefined };
      next();
      return;
    }
  }

  const key = apiKey(req);

  // 2) Scoped OUTBOUND key → write access to a small allowlist of orchestrator-
  //    initiated writes ONLY: POST /outbound/send and POST /messages/:id/summarize
  //    (the agent's muted-group @-mention summary). Checked before the general key
  //    so the read-only wall never blocks the orchestrator. Cheap method/path
  //    checks gate the constant-time compare.
  const outboundKey = env.OUTBOUND_API_KEY;
  const scopedWriteAllowed =
    req.method === 'POST' &&
    (req.path === '/outbound/send' || /^\/messages\/\d+\/summarize$/.test(req.path));
  if (
    key &&
    outboundKey &&
    outboundKey.trim() !== '' &&
    scopedWriteAllowed &&
    timingSafeEqualStr(key, outboundKey)
  ) {
    req.auth = { kind: 'apikey' };
    next();
    return;
  }

  // 3) External API key. Read-only when a personal login backstops full access.
  if (key && hasApiKey && timingSafeEqualStr(key, env.API_KEY as string)) {
    if (isAuthConfigured() && !isReadMethod(req.method)) {
      res.status(403).json({ error: 'API key is read-only' });
      return;
    }
    req.auth = { kind: 'apikey' };
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}
