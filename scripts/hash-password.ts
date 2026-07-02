import { hashPassword } from '../src/auth/password';

/**
 * Generate an AUTH_PASSWORD_HASH for the personal login.
 *   npm run hash-password -- "my secret password"
 * Copy the printed line into .env as AUTH_PASSWORD_HASH=...
 */
const password = process.argv.slice(2).join(' ');
if (!password) {
  // eslint-disable-next-line no-console
  console.error('Usage: npm run hash-password -- <password>');
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log(hashPassword(password));
