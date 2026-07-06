#!/usr/bin/env bash
# Kill all processes belonging to this project — backend/FE servers, Puppeteer Chrome.
# Stops the backend gracefully first (SIGTERM → its own shutdown handler flushes
# stats, closes the DB pool, and cleanly destroys the WhatsApp/Puppeteer client),
# then force-kills anything left after a short timeout instead of skipping to SIGKILL.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRACE_TIMEOUT=15   # seconds to wait for a graceful shutdown before forcing

echo "Stopping whatsapp-manager…"

PIDS="$(fuser 3000/tcp 2>/dev/null || true)"
if [ -n "$PIDS" ]; then
  echo "  Backend running on port 3000 (pid $PIDS) — sending SIGTERM…"
  kill -TERM $PIDS 2>/dev/null || true
  for _ in $(seq "$GRACE_TIMEOUT"); do
    fuser 3000/tcp >/dev/null 2>&1 || break
    sleep 1
  done
  if fuser 3000/tcp >/dev/null 2>&1; then
    echo "  Backend didn't stop in ${GRACE_TIMEOUT}s — forcing…"
    fuser -k 3000/tcp 2>/dev/null && echo "  Backend force-stopped." || true
  else
    echo "  Backend stopped gracefully."
  fi
fi

# Safety net: catches an orphaned Chrome (e.g. left over from a force-kill above,
# or a prior crash) — a no-op after a clean graceful stop, since browser.close()
# already tore it down.
pkill -9 -f "user-data-dir=/mnt/dev/tools/whatsapp_manager/.wwebjs_auth" 2>/dev/null && echo "  Puppeteer Chrome stopped." || true

# Kill both known tmux sessions (dev + test-clone) if they exist.
tmux kill-session -t wm-debug 2>/dev/null && echo "  tmux session (wm-debug) stopped." || true
tmux kill-session -t wm-test 2>/dev/null && echo "  tmux session (wm-test) stopped." || true

echo "Done."
