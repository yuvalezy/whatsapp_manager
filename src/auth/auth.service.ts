import { env } from '../config/env';
import { isAuthConfigured, sign, verify, type JwtPayload } from './jwt';
import { verifyPassword } from './password';

/**
 * Personal login, backed by env credentials (single user — this is a personal
 * service, so there is deliberately no users table). `login()` checks the
 * username + scrypt password hash and returns a forever-JWT (no expiry).
 */
class AuthService {
  /** True when personal login is fully configured (secret + user + hash). */
  enabled(): boolean {
    return (
      isAuthConfigured() &&
      Boolean(env.AUTH_USERNAME && env.AUTH_USERNAME.trim() !== '') &&
      Boolean(env.AUTH_PASSWORD_HASH && env.AUTH_PASSWORD_HASH.trim() !== '')
    );
  }

  /** Verify credentials → signed forever-JWT, or null on failure. */
  login(username: string, password: string): string | null {
    if (!this.enabled()) return null;
    const userOk = username === env.AUTH_USERNAME;
    // Always run the (slow) hash check so timing doesn't leak whether the
    // username matched.
    const passOk = verifyPassword(password, env.AUTH_PASSWORD_HASH as string);
    if (!userOk || !passOk) return null;
    return sign({ sub: username });
  }

  verifyToken(token: string): JwtPayload | null {
    return verify(token);
  }
}

export const authService = new AuthService();
