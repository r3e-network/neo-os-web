#!/usr/bin/env bash
#
# Continuous fuzz daemon — runs forever until killed.
# Logs to docs/reports/fuzz/daemon.log
# PID written to test/fuzz/daemon.pid
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/docs/reports/fuzz"
PID_FILE="$SCRIPT_DIR/daemon.pid"
LOG_FILE="$LOG_DIR/daemon.log"

mkdir -p "$LOG_DIR"

# Increase iterations per run for thorough coverage
export FUZZ_ITERATIONS="${FUZZ_ITERATIONS:-500}"
export FUZZ_CONTINUOUS=1
export FUZZ_LOOP_DELAY_MS="${FUZZ_LOOP_DELAY_MS:-30000}"
export TEST_FUZZ_WIF="${TEST_FUZZ_WIF:-}"
export NODE_NO_WARNINGS=1

echo $$ > "$PID_FILE"
echo "[fuzz-daemon] started at $(date -u +%Y-%m-%dT%H:%M:%SZ) (pid $$)"
echo "[fuzz-daemon] iterations=$FUZZ_ITERATIONS delay=${FUZZ_LOOP_DELAY_MS}ms"
echo "[fuzz-daemon] log=$LOG_FILE"
echo "[fuzz-daemon] stop with: kill \$(cat $PID_FILE)"

cd "$PROJECT_ROOT"
exec node test/fuzz/run_all.mjs >> "$LOG_FILE" 2>&1
