#!/usr/bin/env bash
# Run backend + frontend dev servers side by side in a tmux session.
set -euo pipefail

SESSION="wm-debug"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already running — attaching."
  exec tmux attach -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" -n dev -c "$ROOT_DIR" "npm run dev"
tmux split-window -h -t "$SESSION:dev" -c "$ROOT_DIR/frontend" "npm run dev"
tmux select-layout -t "$SESSION:dev" even-horizontal

exec tmux attach -t "$SESSION"
