#!/usr/bin/env bash
# Cleanly start backend + frontend dev servers side by side in a tmux session.
# Always kills leftovers first — safe to run anytime.
set -euo pipefail

SESSION="wm-debug"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Kill everything from a previous run so we always start clean.
bash "$ROOT_DIR/stop.sh" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n dev -c "$ROOT_DIR"
tmux send-keys -t "$SESSION:dev.0" "npm run dev" Enter
tmux split-window -h -t "$SESSION:dev" -c "$ROOT_DIR/frontend"
tmux send-keys -t "$SESSION:dev.1" "npm run dev" Enter
tmux select-layout -t "$SESSION:dev" even-horizontal

exec tmux attach -t "$SESSION"
