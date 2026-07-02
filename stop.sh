#!/usr/bin/env bash
# Kill all processes belonging to this project — backend/FE servers, Puppeteer Chrome.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping whatsapp-manager…"

# Kill anything on port 3000 (backend)
fuser -k 3000/tcp 2>/dev/null && echo "  Backend (port 3000) stopped." || true

# Kill Puppeteer Chrome instances holding the session lock
pkill -9 -f "user-data-dir=/mnt/dev/tools/whatsapp_manager/.wwebjs_auth" 2>/dev/null && echo "  Puppeteer Chrome stopped." || true

# Kill tmux session if it exists
tmux kill-session -t wm-debug 2>/dev/null && echo "  tmux session stopped." || true

echo "Done."
