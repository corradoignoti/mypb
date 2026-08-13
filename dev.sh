#!/usr/bin/env bash
# Dev launcher: Flask API (auto-reload) + static frontend server.
# Ctrl-C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/mypb-api"
FRONTEND_DIR="$ROOT/frontend"
FRONTEND_PORT="${FRONTEND_PORT:-8000}"

# --- backend venv ---
if [ ! -d "$API_DIR/.venv" ]; then
  echo "==> creating venv in mypb-api/.venv"
  python3 -m venv "$API_DIR/.venv"
  "$API_DIR/.venv/bin/pip" install -q -r "$API_DIR/requirements.txt"
fi

PIDS=()
cleanup() {
  echo
  echo "==> stopping"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> api on http://127.0.0.1:5000 (debug/auto-reload)"
(cd "$API_DIR" && exec .venv/bin/python app.py) &
PIDS+=($!)

echo "==> frontend on http://127.0.0.1:$FRONTEND_PORT"
(cd "$FRONTEND_DIR" && exec python3 -m http.server "$FRONTEND_PORT") &
PIDS+=($!)

wait
