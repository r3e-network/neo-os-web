#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCK_DIR="${TMPDIR:-/tmp}/neo-miniapps-platform.verify-repo.lock"

cleanup_playwright_artifacts() {
  # Ensure hourly validation does not leave stray Playwright/Next web servers behind.
  local port_pid=""
  port_pid="$(lsof -t -iTCP:3004 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${port_pid}" ]]; then
    local port_cmd=""
    port_cmd="$(ps -p "${port_pid}" -o command= 2>/dev/null || true)"
    if [[ "${port_cmd}" == *"neo-miniapps-platform"* || "${port_cmd}" == *"next-server"* ]]; then
      kill "${port_pid}" 2>/dev/null || true
      sleep 0.5
      if ps -p "${port_pid}" >/dev/null 2>&1; then
        kill -9 "${port_pid}" 2>/dev/null || true
      fi
    fi
  fi

  local stray_pids=""
  stray_pids="$(
    {
      pgrep -f "${ROOT_DIR}.*playwright" 2>/dev/null || true
      pgrep -f "${ROOT_DIR}.*next-server" 2>/dev/null || true
    } | sort -n | uniq
  )"
  if [[ -n "${stray_pids}" ]]; then
    kill ${stray_pids} 2>/dev/null || true
    sleep 0.5
    local remaining=""
    remaining="$(
      {
        pgrep -f "${ROOT_DIR}.*playwright" 2>/dev/null || true
        pgrep -f "${ROOT_DIR}.*next-server" 2>/dev/null || true
      } | sort -n | uniq
    )"
    if [[ -n "${remaining}" ]]; then
      kill -9 ${remaining} 2>/dev/null || true
    fi
  fi
}

cleanup_on_exit() {
  local exit_code="$?"
  set +e

  cleanup_playwright_artifacts

  rm -f "${LOCK_DIR}/pid" >/dev/null 2>&1
  rmdir "${LOCK_DIR}" >/dev/null 2>&1

  exit "$exit_code"
}

if mkdir "${LOCK_DIR}" >/dev/null 2>&1; then
  printf "%s\n" "$$" >"${LOCK_DIR}/pid" 2>/dev/null || true
else
  existing_pid=""
  existing_pid="$(cat "${LOCK_DIR}/pid" 2>/dev/null || true)"
  if [[ -n "${existing_pid}" ]] && ps -p "${existing_pid}" >/dev/null 2>&1; then
    echo "[verify_repo] another verification is already running (pid=${existing_pid}); exiting." >&2
  else
    echo "[verify_repo] another verification appears to be running; lock held at ${LOCK_DIR}. Exiting." >&2
  fi
  exit 2
fi

trap cleanup_on_exit EXIT

cleanup_playwright_artifacts

export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}"

npm audit --omit=dev --audit-level=high
npm audit --workspace platform/host-app --omit=dev --audit-level=high
npm run test:deploy-scripts
npm --prefix platform/admin-console test --silent
npm --prefix platform/admin-console run typecheck
rm -rf platform/admin-console/.next
if ! npm --prefix platform/admin-console run build; then
  rm -rf platform/admin-console/.next
  npm --prefix platform/admin-console run build
fi
PLAYWRIGHT_WORKERS="${PLAYWRIGHT_WORKERS:-1}" npm --prefix platform/host-app run test:full
