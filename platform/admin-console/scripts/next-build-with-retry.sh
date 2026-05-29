#!/usr/bin/env bash
set -euo pipefail

ATTEMPTS="${NEXT_BUILD_RETRY_ATTEMPTS:-12}"
LOCK_DIR="/tmp/neo-miniapp-admin-next-build.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"
LOCK_WAIT_SECONDS="${NEXT_BUILD_LOCK_WAIT_SECONDS:-300}"
APP_DIR="$(pwd -P)"

export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}"
export NEXT_DISABLE_SWC_CACHE="${NEXT_DISABLE_SWC_CACHE:-1}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${NEXT_BUILD_MAX_OLD_SPACE_SIZE:-2048}"

tmp_log="$(mktemp "${TMPDIR:-/tmp}/next-build.stderr.XXXXXX")"
terminate() {
  pkill -P $$ >/dev/null 2>&1 || true
  exit 143
}
cleanup() {
  if [[ -f "$LOCK_PID_FILE" ]] && [[ "$(cat "$LOCK_PID_FILE" 2>/dev/null || true)" == "$$" ]]; then
    rm -rf "$LOCK_DIR"
  fi

  if [[ "${NEXT_BUILD_KEEP_LOG:-0}" != "1" ]]; then
    rm -f "$tmp_log"
  else
    echo "[next-build-with-retry] keeping log at $tmp_log"
  fi
}
trap cleanup EXIT
trap terminate TERM INT

acquire_build_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" >"$LOCK_PID_FILE"
    return 0
  fi

  local existing_pid=""
  existing_pid="$(cat "$LOCK_PID_FILE" 2>/dev/null || true)"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
    if [[ "$LOCK_WAIT_SECONDS" -le 0 ]]; then
      echo "[next-build-with-retry] another admin-console build is already running (pid=$existing_pid)"
      exit 1
    fi

    echo "[next-build-with-retry] another admin-console build is already running (pid=$existing_pid); waiting up to ${LOCK_WAIT_SECONDS}s"
    local waited=0
    while [[ "$waited" -lt "$LOCK_WAIT_SECONDS" ]]; do
      sleep 1
      waited=$((waited + 1))
      if ! kill -0 "$existing_pid" >/dev/null 2>&1; then
        break
      fi
    done

    if kill -0 "$existing_pid" >/dev/null 2>&1; then
      echo "[next-build-with-retry] another admin-console build is still running after ${LOCK_WAIT_SECONDS}s (pid=$existing_pid)"
      exit 1
    fi
  fi

  echo "[next-build-with-retry] removing stale build lock"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  echo "$$" >"$LOCK_PID_FILE"
}

acquire_build_lock

resolve_next_bin() {
  node -e "try{process.stdout.write(require.resolve('next/dist/bin/next'))}catch(e){process.exit(1)}" 2>/dev/null
}

NEXT_BIN="$(resolve_next_bin || true)"
if [[ -z "${NEXT_BIN}" ]]; then
  echo "[next-build-with-retry] failed to resolve local next binary (next/dist/bin/next)"
  echo "[next-build-with-retry] hint: run this via npm so node_modules are available"
  exit 1
fi

clean_next_output() {
  if [[ -d .next ]]; then
    chmod -R u+w .next >/dev/null 2>&1 || true
    for _ in 1 2 3; do
      rm -rf .next >/dev/null 2>&1 || true
      [[ -d .next ]] || return 0
      sleep 0.2
    done
  fi
  return 0
}

kill_stray_next_builds() {
  ps ax -o pid= -o command= 2>/dev/null \
    | rg "node .*next.* build" \
    | awk '{print $1}' \
    | while read -r pid; do
      [[ -n "${pid}" ]] || continue
      local cwd=""
      cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
      [[ "$cwd" == "$APP_DIR" ]] || continue
      kill "${pid}" >/dev/null 2>&1 || true
    done || true
  return 0
}

last_log=""
for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "[next-build-with-retry] attempt $attempt/$ATTEMPTS"

  kill_stray_next_builds
  clean_next_output

  : >"$tmp_log"
  set +e
  node "$NEXT_BIN" build > >(tee "$tmp_log") 2>&1
  build_exit_code=$?
  set -e
  if [[ "$build_exit_code" -eq 0 ]]; then
    build_id="$(cat .next/BUILD_ID 2>/dev/null || true)"
    if [[ -z "${build_id}" ]]; then
      echo "[next-build-with-retry] missing .next/BUILD_ID; retrying..."
      kill_stray_next_builds
      clean_next_output
      sleep 1
      continue
    fi

    if [[ ! -s ".next/server/pages-manifest.json" ]]; then
      echo "[next-build-with-retry] missing .next/server/pages-manifest.json for BUILD_ID=${build_id}; retrying..."
      kill_stray_next_builds
      clean_next_output
      sleep 1
      continue
    fi

    if [[ ! -s ".next/build-manifest.json" ]]; then
      echo "[next-build-with-retry] missing .next/build-manifest.json for BUILD_ID=${build_id}; retrying..."
      kill_stray_next_builds
      clean_next_output
      sleep 1
      continue
    fi

    cat "$tmp_log"
    exit 0
  fi

  if [[ "$build_exit_code" -eq 143 || "$build_exit_code" -eq 137 ]]; then
    echo "[next-build-with-retry] next build terminated (exit_code=$build_exit_code); retrying..."
    kill_stray_next_builds
    clean_next_output
    sleep 1
    continue
  fi

  last_log="$(cat "$tmp_log" 2>/dev/null || true)"
  cat "$tmp_log" || true

  if echo "$last_log" | rg -q "ENOENT: no such file or directory|ENOTEMPTY: directory not empty|PageNotFoundError: Cannot find module for page:|Cannot find module '.*/\\.next/server/pages/.*\\.js'|Cannot find module '.*/\\.next/server/next-font-manifest\\.json'|pages-manifest\\.json|build-manifest\\.json|prerender-manifest\\.json|Unexpected end of JSON input|Linting and checking validity of types \\.\\.\\.[[:space:]]*$|Creating an optimized production build \\.\\.\\.[[:space:]]*$|Collecting page data \\.\\.\\.[[:space:]]*$|Generating static pages \\([0-9]+/[0-9]+\\) \\.\\.\\.[[:space:]]*$|Collecting build traces \\.\\.\\.[[:space:]]*$"; then
    echo "[next-build-with-retry] detected flaky build artifact error; retrying..."
    kill_stray_next_builds
    sleep 1
    continue
  fi

  echo "[next-build-with-retry] non-retryable build failure"
  NEXT_BUILD_KEEP_LOG=1
  echo "[next-build-with-retry] last stderr (tail):"
  echo "$last_log" | tail -n 80
  exit 1
done

echo "[next-build-with-retry] exhausted retries ($ATTEMPTS)"
NEXT_BUILD_KEEP_LOG=1
exit 1
