#!/usr/bin/env bash
set -euo pipefail

ATTEMPTS="${NEXT_BUILD_RETRY_ATTEMPTS:-12}"
LOCK_DIR="${TMPDIR:-/tmp}/neo-miniapp-host-next-build.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"

# Next.js standalone tracing may hit intermittent `.next/*` artifact races on
# some local filesystems. Default to one build worker for deterministic release
# builds; CI can opt into a higher value after proving the runner is stable.
export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}"
export NEXT_DISABLE_SWC_CACHE="${NEXT_DISABLE_SWC_CACHE:-1}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"

tmp_log="$(mktemp "${TMPDIR:-/tmp}/next-build.stderr.XXXXXX")"
terminate() {
  # If the runner aborts (SIGTERM/SIGINT), ensure we don't leave `next build`
  # running and deleting `.next/*` while other checks (e.g. Playwright's
  # standalone server) are active.
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
    echo "[next-build-with-retry] another host-app build is already running (pid=$existing_pid)"
    exit 1
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
  local repo_root=""
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "${repo_root}" ]] || return 0

  ps ax -o pid= -o command= 2>/dev/null \
    | rg "node .*next.* build" \
    | rg -F "${repo_root}" \
    | awk '{print $1}' \
    | while read -r pid; do
      [[ -n "${pid}" ]] || continue
      kill "${pid}" >/dev/null 2>&1 || true
    done || true
  return 0
}

last_log=""
for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "[next-build-with-retry] attempt $attempt/$ATTEMPTS"

  # Always start from a clean build dir to avoid intermittent trace/copy races
  # seen with standalone output on some local filesystems.
  kill_stray_next_builds
  clean_next_output

  : >"$tmp_log"
  set +e
  node "$NEXT_BIN" build > >(tee "$tmp_log") 2>&1
  build_exit_code=$?
  set -e
  if [[ "$build_exit_code" -eq 0 ]]; then
    # Guard against "successful" builds that still leave an inconsistent `.next`
    # tree (observed on some local filesystems): BUILD_ID updated but the
    # corresponding `.next/static/<BUILD_ID>/*Manifest.js` or key SSG HTML files
    # are missing. These show up later as 400/404 `_buildManifest.js` and
    # missing `*.html` errors when running the standalone server.
    build_id="$(cat .next/BUILD_ID 2>/dev/null || true)"
    if [[ -z "${build_id}" ]]; then
      echo "[next-build-with-retry] missing .next/BUILD_ID; retrying..."
      kill_stray_next_builds
      clean_next_output
      sleep 1
      continue
    fi

    if [[ ! -s ".next/static/${build_id}/_buildManifest.js" || ! -s ".next/static/${build_id}/_ssgManifest.js" ]]; then
      echo "[next-build-with-retry] static manifests missing for BUILD_ID=${build_id}; retrying..."
      kill_stray_next_builds
      clean_next_output
      sleep 1
      continue
    fi

    # Guard against "successful" builds that still leave an inconsistent `.next`
    # tree. In addition to core docs pages, validate a small set of high-traffic
    # routes used by the Playwright surface crawl. When these go missing, the
    # standalone server can crash mid-suite (surfacing as ERR_CONNECTION_REFUSED).
    for html_page in index docs developer explorer account analytics miniapps privacy terms test; do
      if [[ ! -s ".next/server/pages/${html_page}.html" ]]; then
        echo "[next-build-with-retry] missing .next/server/pages/${html_page}.html for BUILD_ID=${build_id}; retrying..."
        kill_stray_next_builds
        clean_next_output
        sleep 1
        continue 2
      fi
    done

    if [[ ! -s ".next/standalone/platform/host-app/server.js" ]]; then
      echo "[next-build-with-retry] missing standalone server.js for BUILD_ID=${build_id}; retrying..."
      kill_stray_next_builds
      clean_next_output
      sleep 1
      continue
    fi

    # Keep post-build standalone preparation inside the same build lock. The
    # Playwright production server runs from these copied artifacts; if another
    # validation build cleans `.next` in the small gap between `next build` and
    # post-build copying, E2E sees missing pages or a vanished server.
    node scripts/prepare-standalone.mjs
    if [[ "${PREPARE_E2E_STANDALONE:-0}" == "1" ]]; then
      node scripts/prepare-e2e-standalone.mjs
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

  if echo "$last_log" | rg -q "ENOENT: no such file or directory|ENOTEMPTY: directory not empty|PageNotFoundError: Cannot find module for page:|Cannot find module '.*/\\.next/server/pages/.*\\.js'|Cannot find module '.*/\\.next/server/next-font-manifest\\.json'|Build optimization failed: found pages without a React Component as default export|page-without-valid-component|Failed to collect page data for /404|middleware-manifest\\.json|prerender-manifest\\.json|Unexpected end of JSON input|Linting and checking validity of types \\.\\.\\.[[:space:]]*$|Creating an optimized production build \\.\\.\\.[[:space:]]*$|Collecting page data \\.\\.\\.[[:space:]]*$|Generating static pages \\([0-9]+/[0-9]+\\) \\.\\.\\.[[:space:]]*$|Collecting build traces \\.\\.\\.[[:space:]]*$"; then
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
