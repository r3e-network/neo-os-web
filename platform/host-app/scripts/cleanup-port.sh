#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3004}"

if ! command -v lsof >/dev/null 2>&1; then
  exit 0
fi

PIDS="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"

if [[ -z "${PIDS}" ]]; then
  exit 0
fi

echo "[cleanup-port] killing listeners on :${PORT} -> ${PIDS}"
kill ${PIDS} 2>/dev/null || true
sleep 0.5
kill -9 ${PIDS} 2>/dev/null || true
