import { lstatSync, readFileSync, readlinkSync, rmSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { logger } from '../logger';

/**
 * Chrome's profile-lock files. `SingletonLock` is a symlink named `<host>-<pid>`
 * pointing at the browser process that owns the profile.
 */
const SINGLETON_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];

const TERM_GRACE_MS = 5000;
const POLL_MS = 200;

/** LocalAuth stores each client under `<SESSION_DATA_PATH>/session-<clientId>`. */
function userDataDir(): string {
  return path.resolve(env.SESSION_DATA_PATH, `session-${env.WHATSAPP_CLIENT_ID}`);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Full argv of `pid`, space-joined. `null` when /proc is unreadable (non-Linux, or gone). */
function cmdlineOf(pid: number): string | null {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
  } catch {
    return null;
  }
}

/** The PID recorded in the SingletonLock symlink (`<host>-<pid>`), if parseable. */
function lockOwnerPid(dir: string): number | null {
  const lockPath = path.join(dir, 'SingletonLock');
  try {
    const target = readlinkSync(lockPath); // e.g. "fedora-3211229"
    const pid = Number(target.slice(target.lastIndexOf('-') + 1));
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function removeLockFiles(dir: string): void {
  for (const f of SINGLETON_FILES) {
    rmSync(path.join(dir, f), { force: true });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `SingletonLock` is a symlink whose target (`<host>-<pid>`) is a label, not a real
 * path — so `existsSync` follows it, finds nothing, and reports the lock as absent.
 * `lstat` inspects the link itself.
 */
function lockExists(dir: string): boolean {
  return lstatSync(path.join(dir, 'SingletonLock'), { throwIfNoEntry: false }) !== undefined;
}

/**
 * Reclaim the Chrome profile lock before launching a client.
 *
 * A previous run's browser routinely outlives the Node process: `tsx watch`
 * force-kills on reload ("Previous process hasn't exited yet"), Ctrl-C races
 * `client.destroy()`, and SIGKILL/crash/power-loss skip teardown entirely. The
 * orphaned browser keeps holding this profile, so the next launch dies with
 * "The browser is already running for <dir>" (or a Page.navigate timeout) — the
 * client never reaches `ready` and the UI looks stuck "waiting to link device",
 * even though the session itself is perfectly valid.
 *
 * This service is single-instance by design, so at startup nothing may legitimately
 * own our profile: any live owner is a leftover and is killed. Kills are narrowly
 * scoped — we only ever signal a PID that /proc confirms is a browser running with
 * *our* `--user-data-dir`, never a bare "is it alive" guess.
 */
export async function reclaimSessionLock(): Promise<void> {
  const dir = userDataDir();
  if (!lockExists(dir)) return;

  const pid = lockOwnerPid(dir);
  if (pid === null) {
    logger.warn({ dir }, 'Unreadable Chrome profile lock — clearing it');
    removeLockFiles(dir);
    return;
  }

  if (!isAlive(pid)) {
    logger.info({ pid, dir }, 'Clearing stale Chrome profile lock (owner is gone)');
    removeLockFiles(dir);
    return;
  }

  const cmdline = cmdlineOf(pid);
  if (cmdline === null) {
    // Can't verify ownership (no /proc). Killing on a liveness guess risks hitting
    // an unrelated process that inherited the PID, so leave it to puppeteer.
    logger.warn(
      { pid, dir },
      'Chrome profile lock held by a process we cannot verify — leaving it alone',
    );
    return;
  }

  if (!cmdline.includes(`--user-data-dir=${dir}`)) {
    logger.info({ pid, dir }, 'Chrome profile lock points at an unrelated PID — clearing it');
    removeLockFiles(dir);
    return;
  }

  logger.warn({ pid, dir }, 'Killing orphaned browser still holding the WhatsApp profile');
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    logger.warn({ err, pid }, 'SIGTERM to orphaned browser failed (already gone?)');
  }

  const deadline = Date.now() + TERM_GRACE_MS;
  while (Date.now() < deadline && isAlive(pid)) {
    await sleep(POLL_MS);
  }

  if (isAlive(pid)) {
    logger.warn({ pid }, 'Orphaned browser ignored SIGTERM — sending SIGKILL');
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* raced us and exited */
    }
    await sleep(POLL_MS);
  }

  // A SIGKILLed browser never cleans up after itself.
  removeLockFiles(dir);
  logger.info({ pid }, 'Reclaimed WhatsApp profile lock from orphaned browser');
}
