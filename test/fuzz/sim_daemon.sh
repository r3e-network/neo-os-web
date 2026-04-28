#!/usr/bin/env bash
#
# Multi-user business workflow sim daemon — runs forever until killed.
# Logs to docs/reports/multi-user-sim/daemon.log.
# PID written to test/fuzz/sim_daemon.pid.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/docs/reports/multi-user-sim"
PID_FILE="$SCRIPT_DIR/sim_daemon.pid"
LOG_FILE="$LOG_DIR/daemon.log"

mkdir -p "$LOG_DIR"

export SIM_USERS="${SIM_USERS:-3}"
export SIM_LOOP_DELAY_MS="${SIM_LOOP_DELAY_MS:-30000}"
export SIM_GAS_PER_USER="${SIM_GAS_PER_USER:-2000000000}"
export SIM_NEO_PER_USER="${SIM_NEO_PER_USER:-3}"
if [[ -z "${NEO_TESTNET_WIF:-${TEST_FUZZ_WIF:-}}" ]]; then
  echo "[sim-daemon] NEO_TESTNET_WIF or TEST_FUZZ_WIF is required; refusing to run with embedded private keys." >&2
  exit 0
fi
export NODE_NO_WARNINGS=1

echo $$ > "$PID_FILE"
echo "[sim-daemon] started at $(date -u +%Y-%m-%dT%H:%M:%SZ) (pid $$)"
echo "[sim-daemon] users=$SIM_USERS delay=${SIM_LOOP_DELAY_MS}ms"
echo "[sim-daemon] log=$LOG_FILE"
echo "[sim-daemon] stop with: kill \$(cat $PID_FILE)"

cd "$PROJECT_ROOT"
exec node test/fuzz/multi_user_business_sim.mjs >> "$LOG_FILE" 2>&1
