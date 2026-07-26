#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3004}"

if ! command -v lsof >/dev/null 2>&1; then
  exit 0
fi

# lsof prints one pid per line and kill takes several, so the pids go into an
# array rather than a string that later has to be re-split by the shell.
PIDS=()
while IFS= read -r pid; do
  # `if` rather than `&&`: a false AND-list at the end of the loop body would
  # be a failing command and abort the script under `set -e`.
  if [[ -n "${pid}" ]]; then
    PIDS+=("${pid}")
  fi
done < <(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)

if [[ "${#PIDS[@]}" -eq 0 ]]; then
  exit 0
fi

echo "[cleanup-port] killing listeners on :${PORT} -> ${PIDS[*]}"
kill "${PIDS[@]}" 2>/dev/null || true
sleep 0.5
kill -9 "${PIDS[@]}" 2>/dev/null || true
