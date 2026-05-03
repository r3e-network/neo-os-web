#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a
if [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
fi
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.local"
fi
set +a

RUN_FLAGSHIP=1
RUN_SELECTED=1

usage() {
  cat <<'EOF'
Usage: bash deploy/scripts/run_full_live_smoke.sh [--flagship-only|--selected-only]

Runs repeatable live smoke stages:
- flagship live user flows
- selected miniapps live smoke

Notes:
- loads .env / .env.local when present
- does not assume CI or GitHub secrets
- stage-specific target filters still come from:
  - FLAGSHIP_LIVE_TARGETS
  - SELECTED_MINIAPP_SMOKE_TARGETS
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --flagship-only)
      RUN_SELECTED=0
      shift
      ;;
    --selected-only)
      RUN_FLAGSHIP=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "$RUN_FLAGSHIP" -eq 0 ] && [ "$RUN_SELECTED" -eq 0 ]; then
  echo "No live smoke stages selected." >&2
  usage >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_DIR="$PROJECT_ROOT/docs/reports/live-smoke/$TIMESTAMP"
mkdir -p "$REPORT_DIR"

FLAGSHIP_REPORT_PATH="$REPORT_DIR/flagship.json"
SELECTED_REPORT_PATH="$REPORT_DIR/selected.json"
SUMMARY_REPORT_PATH="$REPORT_DIR/summary.json"
FLAGSHIP_LOG_PATH="$REPORT_DIR/flagship.log"
SELECTED_LOG_PATH="$REPORT_DIR/selected.log"

ORIGINAL_TEST_SMOKE_ADMIN_WIF="${TEST_SMOKE_ADMIN_WIF:-}"
ORIGINAL_TEST_SMOKE_USER_WIF="${TEST_SMOKE_USER_WIF:-}"

echo "=== Full Live Smoke ==="
echo "Report dir: $REPORT_DIR"
echo "RPC: ${NEO_RPC_URL:-https://testnet1.neo.coz.io:443}"
echo "Flagship targets: ${FLAGSHIP_LIVE_TARGETS:-all}"
echo "Selected targets: ${SELECTED_MINIAPP_SMOKE_TARGETS:-all}"

FLAGSHIP_COMMAND="FLAGSHIP_LIVE_REPORT_PATH=$FLAGSHIP_REPORT_PATH node $PROJECT_ROOT/deploy/scripts/live_validate_flagship_user_flows.js"
SELECTED_COMMAND="SELECTED_MINIAPP_SMOKE_REPORT_PATH=$SELECTED_REPORT_PATH node $PROJECT_ROOT/deploy/scripts/live_validate_selected_miniapps.js"

if [ "$RUN_FLAGSHIP" -eq 1 ]; then
  if [ -n "${LIVE_SMOKE_FLAGSHIP_ADMIN_WIF:-}" ]; then
    export TEST_SMOKE_ADMIN_WIF="$LIVE_SMOKE_FLAGSHIP_ADMIN_WIF"
  elif [ -n "${TEE_PRIVATE_KEY:-}" ]; then
    export TEST_SMOKE_ADMIN_WIF="$TEE_PRIVATE_KEY"
  fi

  echo ""
  echo "=== Flagship Live Smoke ==="
  echo "Admin signer: ${TEST_SMOKE_ADMIN_WIF:+configured}"
  echo "Command: $FLAGSHIP_COMMAND"
  if FLAGSHIP_LIVE_REPORT_PATH="$FLAGSHIP_REPORT_PATH" \
       node "$PROJECT_ROOT/deploy/scripts/live_validate_flagship_user_flows.js" \
       2>&1 | tee "$FLAGSHIP_LOG_PATH"; then
    FLAGSHIP_STATUS=0
  else
    FLAGSHIP_STATUS=$?
  fi
else
  FLAGSHIP_STATUS=0
fi

export TEST_SMOKE_ADMIN_WIF="$ORIGINAL_TEST_SMOKE_ADMIN_WIF"

if [ "$RUN_SELECTED" -eq 1 ]; then
  if [ -n "${LIVE_SMOKE_SELECTED_USER_WIF:-}" ]; then
    export TEST_SMOKE_USER_WIF="$LIVE_SMOKE_SELECTED_USER_WIF"
  elif [ -n "${TEE_PRIVATE_KEY:-}" ]; then
    export TEST_SMOKE_USER_WIF="$TEE_PRIVATE_KEY"
  fi

  echo ""
  echo "=== Selected MiniApps Live Smoke ==="
  echo "User signer: ${TEST_SMOKE_USER_WIF:+configured}"
  echo "Command: $SELECTED_COMMAND"
  if SELECTED_MINIAPP_SMOKE_REPORT_PATH="$SELECTED_REPORT_PATH" \
       node "$PROJECT_ROOT/deploy/scripts/live_validate_selected_miniapps.js" \
       2>&1 | tee "$SELECTED_LOG_PATH"; then
    SELECTED_STATUS=0
  else
    SELECTED_STATUS=$?
  fi
else
  SELECTED_STATUS=0
fi

export TEST_SMOKE_USER_WIF="$ORIGINAL_TEST_SMOKE_USER_WIF"

FLAGSHIP_STATUS="${FLAGSHIP_STATUS:-0}" \
SELECTED_STATUS="${SELECTED_STATUS:-0}" \
FLAGSHIP_REPORT_PATH="$FLAGSHIP_REPORT_PATH" \
SELECTED_REPORT_PATH="$SELECTED_REPORT_PATH" \
SUMMARY_REPORT_PATH="$SUMMARY_REPORT_PATH" \
FLAGSHIP_LOG_PATH="$FLAGSHIP_LOG_PATH" \
SELECTED_LOG_PATH="$SELECTED_LOG_PATH" \
RUN_FLAGSHIP="$RUN_FLAGSHIP" \
RUN_SELECTED="$RUN_SELECTED" \
FLAGSHIP_COMMAND="$FLAGSHIP_COMMAND" \
SELECTED_COMMAND="$SELECTED_COMMAND" \
FLAGSHIP_LIVE_TARGETS="${FLAGSHIP_LIVE_TARGETS:-}" \
SELECTED_MINIAPP_SMOKE_TARGETS="${SELECTED_MINIAPP_SMOKE_TARGETS:-}" \
node <<'NODE'
const fs = require("fs");

function loadJson(path) {
  if (!path || !fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function exists(path) {
  return Boolean(path) && fs.existsSync(path);
}

function countFlagshipResults(report) {
  if (!report?.results || typeof report.results !== "object") return { pass: 0, fail: 0, skipped: 0 };
  const counts = { pass: 0, fail: 0, skipped: 0 };
  for (const value of Object.values(report.results)) {
    if (value?.skipped) counts.skipped += 1;
    else if (value?.ok === true) counts.pass += 1;
    else counts.fail += 1;
  }
  return counts;
}

function countSelectedResults(report) {
  if (!report?.results || typeof report.results !== "object") return { pass: 0, fail: 0, skipped: 0 };
  const counts = { pass: 0, fail: 0, skipped: 0 };
  for (const value of Object.values(report.results)) {
    if (value?.status === "pass") counts.pass += 1;
    else if (value?.status === "fail") counts.fail += 1;
    else counts.skipped += 1;
  }
  return counts;
}

const flagship = loadJson(process.env.FLAGSHIP_REPORT_PATH);
const selected = loadJson(process.env.SELECTED_REPORT_PATH);
const runFlagship = Number(process.env.RUN_FLAGSHIP || "0") === 1;
const runSelected = Number(process.env.RUN_SELECTED || "0") === 1;
const warnings = [];
if (runFlagship && !flagship) warnings.push("flagship stage did not produce a JSON report");
if (runSelected && !selected) warnings.push("selected stage did not produce a JSON report");
const summary = {
  generatedAt: new Date().toISOString(),
  requestedStages: {
    flagship: runFlagship,
    selected: runSelected,
  },
  filters: {
    flagshipTargets: String(process.env.FLAGSHIP_LIVE_TARGETS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    selectedTargets: String(process.env.SELECTED_MINIAPP_SMOKE_TARGETS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  },
  flagshipStatus: Number(process.env.FLAGSHIP_STATUS || "0"),
  selectedStatus: Number(process.env.SELECTED_STATUS || "0"),
  flagshipCounts: countFlagshipResults(flagship),
  selectedCounts: countSelectedResults(selected),
  stages: {
    flagship: {
      enabled: runFlagship,
      command: process.env.FLAGSHIP_COMMAND || null,
      exitCode: Number(process.env.FLAGSHIP_STATUS || "0"),
      reportPath: process.env.FLAGSHIP_REPORT_PATH || null,
      reportExists: exists(process.env.FLAGSHIP_REPORT_PATH),
      logPath: process.env.FLAGSHIP_LOG_PATH || null,
      logExists: exists(process.env.FLAGSHIP_LOG_PATH),
    },
    selected: {
      enabled: runSelected,
      command: process.env.SELECTED_COMMAND || null,
      exitCode: Number(process.env.SELECTED_STATUS || "0"),
      reportPath: process.env.SELECTED_REPORT_PATH || null,
      reportExists: exists(process.env.SELECTED_REPORT_PATH),
      logPath: process.env.SELECTED_LOG_PATH || null,
      logExists: exists(process.env.SELECTED_LOG_PATH),
    },
  },
  reports: {
    flagship: process.env.FLAGSHIP_REPORT_PATH || null,
    selected: process.env.SELECTED_REPORT_PATH || null,
    summary: process.env.SUMMARY_REPORT_PATH || null,
  },
  warnings,
};

fs.writeFileSync(process.env.SUMMARY_REPORT_PATH, JSON.stringify(summary, null, 2) + "\n");
console.log("");
console.log("=== Live Smoke Summary ===");
console.log(JSON.stringify(summary, null, 2));
NODE

echo ""
echo "Summary report: $SUMMARY_REPORT_PATH"

if [ "${FLAGSHIP_STATUS:-0}" -ne 0 ] || [ "${SELECTED_STATUS:-0}" -ne 0 ]; then
  exit 1
fi

if [ "$RUN_FLAGSHIP" -eq 1 ] && [ ! -s "$FLAGSHIP_REPORT_PATH" ]; then
  echo "Flagship live smoke did not produce a report: $FLAGSHIP_REPORT_PATH" >&2
  exit 1
fi

if [ "$RUN_SELECTED" -eq 1 ] && [ ! -s "$SELECTED_REPORT_PATH" ]; then
  echo "Selected miniapps live smoke did not produce a report: $SELECTED_REPORT_PATH" >&2
  exit 1
fi
