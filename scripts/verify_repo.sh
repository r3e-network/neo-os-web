#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCK_DIR="${TMPDIR:-/tmp}/neo-os-web.verify-repo.lock"

cleanup_playwright_artifacts() {
  # Ensure hourly validation does not leave stray Playwright/Next web servers behind.
  local port_pid=""
  port_pid="$(lsof -t -iTCP:3004 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${port_pid}" ]]; then
    local port_cmd=""
    port_cmd="$(ps -p "${port_pid}" -o command= 2>/dev/null || true)"
    if [[ "${port_cmd}" == *"neo-os-web"* || "${port_cmd}" == *"next-server"* ]]; then
      kill "${port_pid}" 2>/dev/null || true
      sleep 0.5
      if ps -p "${port_pid}" >/dev/null 2>&1; then
        kill -9 "${port_pid}" 2>/dev/null || true
      fi
    fi
  fi

  # pgrep emits one pid per line and kill accepts several, so the pids are
  # collected into an array instead of a string the shell has to re-split.
  local stray_pids=()
  local stray_pid
  while IFS= read -r stray_pid; do
    # `if` rather than `&&`: a false AND-list at the end of the loop body would
    # be a failing command and abort the script under `set -e`.
    if [[ -n "${stray_pid}" ]]; then
      stray_pids+=("${stray_pid}")
    fi
  done < <(
    {
      pgrep -f "${ROOT_DIR}.*playwright" 2>/dev/null || true
      pgrep -f "${ROOT_DIR}.*next-server" 2>/dev/null || true
    } | sort -n | uniq
  )
  if [[ "${#stray_pids[@]}" -gt 0 ]]; then
    kill "${stray_pids[@]}" 2>/dev/null || true
    sleep 0.5
    local remaining=()
    local remaining_pid
    while IFS= read -r remaining_pid; do
      if [[ -n "${remaining_pid}" ]]; then
        remaining+=("${remaining_pid}")
      fi
    done < <(
      {
        pgrep -f "${ROOT_DIR}.*playwright" 2>/dev/null || true
        pgrep -f "${ROOT_DIR}.*next-server" 2>/dev/null || true
      } | sort -n | uniq
    )
    if [[ "${#remaining[@]}" -gt 0 ]]; then
      kill -9 "${remaining[@]}" 2>/dev/null || true
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

should_fail_audit_output() {
  local output="$1"
  if printf "%s\n" "$output" | grep -Eqi "(Severity: (high|critical)|[[:space:]](high|critical)[[:space:]]severity vulnerabilities?)"; then
    return 0
  fi
  return 1
}

# Run one `npm audit` scope and classify its outcome.
#
# npm@10+ exits non-zero for moderate/low findings too, and the registry is not
# always reachable from a validation runner, so a bare exit code cannot decide
# this. The three outcomes are: network failure (skip, not the repo's fault),
# high/critical finding (fail), anything else (report and continue).
#
# Args: <label for diagnostics> <npm audit arguments...>
run_npm_audit_scope() {
  local label="$1"
  shift

  local audit_output=""
  if audit_output="$(npm audit "$@" --omit=dev --audit-level=high 2>&1)"; then
    printf "%s\n" "$audit_output"
    return 0
  fi

  if printf "%s\n" "$audit_output" | grep -Eqi "(ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|socket hang up|SSL connection timeout|request to .* failed|audit endpoint returned an error)"; then
    echo "[verify_repo] npm audit skipped due to network error (${label})." >&2
    return 0
  fi

  if should_fail_audit_output "$audit_output"; then
    printf "%s\n" "$audit_output" >&2
    return 1
  fi

  printf "%s\n" "$audit_output"
  echo "[verify_repo] npm audit returned non-zero but no high/critical findings were detected (${label}); continuing." >&2
  return 0
}

run_npm_audit_scope "root audit"
run_npm_audit_scope "host-app audit" --workspace platform/host-app

npm run test:deploy-scripts
npm run test:shared-aa-governance

# Framework and repo-hygiene gates. Each is a `check:` script that exits
# non-zero on a real regression, so they run before the slower suites.
for gate in \
  check:repo:secret-material \
  check:repo:lint-scope \
  check:platform:contracts \
  check:factory-template-artifacts \
  check:platform:engine-base \
  check:platform:game-migration \
  check:platform:social-framework \
  check:platform:anchor-framework \
  check:platform:registry-framework \
  check:platform:defi-framework \
  check:platform:factory-framework \
  check:platform:vesting-framework \
  check:platform:escrow-framework \
  check:platform:joint-aa \
  check:platform:shared-aa-roster \
  check:cross-repo:duplication; do
  echo "[verify_repo] gate: ${gate}"
  npm run -s "${gate}"
done

npm run -s test:shared
npm --prefix platform/admin-console test --silent
npm --prefix platform/admin-console run typecheck

# Next occasionally leaves a partially written .next tree behind, which makes
# the following build fail on stale chunks; clearing it before each attempt is
# the recovery path.
build_admin_console() {
  rm -rf platform/admin-console/.next >/dev/null 2>&1 || true
  npm --prefix platform/admin-console run build
}
if ! build_admin_console; then
  build_admin_console
fi
PLAYWRIGHT_WORKERS="${PLAYWRIGHT_WORKERS:-1}" npm --prefix platform/host-app run test:full
