import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from './auth.service';

/**
 * POST /auth/login is PUBLIC (mounted before the auth guard) and rate-limited to
 * blunt brute-force. GET /auth/me lives behind the guard (see app.ts) and just
 * echoes the resolved caller so the frontend can confirm a token is still valid.
 */
export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again shortly' },
});

authRouter.post('/login', loginLimiter, (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ error: '"username" and "password" are required' });
    return;
  }
  if (!authService.enabled()) {
    res.status(503).json({ error: 'Personal login is not configured on this server.' });
    return;
  }
  const token = authService.login(username, password);
  if (!token) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  res.json({ data: { token, username } });
});
