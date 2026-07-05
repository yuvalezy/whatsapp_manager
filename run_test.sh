#!/usr/bin/env bash
#
# run_test.sh — run whatsapp_manager as a TEST clone on the normal port 3000.
# Same auth/login and WhatsApp session as prod, but isolated: DB whatsapp_manager_test
# + portal account-test.portal.net. Stops the prod instance first (you run only test now).
#
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION="wm-test"
CERT="${NODE_EXTRA_CA_CERTS:-/mnt/dev/portal/origin/nginx/ssl/localhost.crt}"
ENVFILE="$ROOT_DIR/.env.test"

[ -f "$ENVFILE" ] || { echo "✗ $ENVFILE missing"; exit 1; }
[ -f "$CERT" ]    || { echo "✗ dev cert not found: $CERT"; exit 1; }

# Free port 3000 — you run only the test now. Kills prod + any prior test.
bash "$ROOT_DIR/stop.sh" 2>/dev/null || true
tmux kill-session -t wm-debug 2>/dev/null || true
tmux kill-session -t "$SESSION" 2>/dev/null || true
sleep 1 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n dev -c "$ROOT_DIR"
tmux send-keys -t "$SESSION:dev.0" \
  "NODE_EXTRA_CA_CERTS='$CERT' DOTENV_CONFIG_PATH='$ENVFILE' npm run dev" Enter
tmux split-window -h -t "$SESSION:dev" -c "$ROOT_DIR/frontend"
tmux send-keys -t "$SESSION:dev.1" "npm run dev" Enter
tmux select-layout -t "$SESSION:dev" even-horizontal

cat <<INFO

▶ test whatsapp_manager (clone) starting in tmux '$SESSION'
   backend  : http://localhost:3000
   DB       : whatsapp_manager_test        portal : account-test.portal.net
   login    : your normal username / password (JWT unchanged from prod)
   WhatsApp : cloned session — no QR
   detach: Ctrl-b d     stop: tmux kill-session -t $SESSION
INFO

exec tmux attach -t "$SESSION"
