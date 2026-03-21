#!/bin/bash
#
# Platform-owned Neo N3 testnet verification.
# Preferred direct Oracle / direct AA validation now lives in deploy/scripts/verify_cross_repo_testnet.sh.
# This script checks only platform-native flows that still matter for the
# current direct MiniApp architecture:
# - Governance
# - PriceFeed availability
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE=".env"
MINIAPP_HASH=""
APP_ID=""
WAIT_CALLBACK="true"
CALLBACK_TIMEOUT_SECONDS="300"
SKIP_SIGNER_FUNDING="false"
SKIP_PRICEFEED_WATCHDOG="false"
SKIP_STATS_ROLLUP_CHECK="false"

usage() {
  cat <<'EOF'
Usage: ./deploy/scripts/verify_testnet_workflows.sh [OPTIONS]

Options:
  --env-file <path>       Path to env file (default: .env)
  --skip-signer-funding   Skip pre-flight txproxy signer funding check
  --skip-pricefeed-watchdog
                          Skip pre-flight pricefeed freshness watchdog
  --skip-stats-rollup-check
                          Skip pre-flight miniapp stats rollup compatibility check
  -h, --help              Show this help

This script sends real testnet transactions for platform-native flow checks.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"; shift 2;;
    --miniapp-hash)
      MINIAPP_HASH="$2"; shift 2;;
    --app-id)
      APP_ID="$2"; shift 2;;
    --no-wait-callback)
      WAIT_CALLBACK="false"; shift;;
    --skip-signer-funding)
      SKIP_SIGNER_FUNDING="true"; shift;;
    --skip-pricefeed-watchdog)
      SKIP_PRICEFEED_WATCHDOG="true"; shift;;
    --skip-stats-rollup-check)
      SKIP_STATS_ROLLUP_CHECK="true"; shift;;
    --callback-timeout)
      CALLBACK_TIMEOUT_SECONDS="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if ! command -v go >/dev/null 2>&1; then
  echo "go not found in PATH" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

missing=()
require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
}

require_env "NEO_TESTNET_WIF"
require_env "CONTRACT_GOVERNANCE_HASH"
require_env "CONTRACT_APPREGISTRY_HASH"

if [[ "${#missing[@]}" -gt 0 ]]; then
  echo "Missing required environment variables:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

if [[ -z "${NEO_RPC_URL:-}" ]]; then
  echo "Warning: NEO_RPC_URL not set; scripts will default to testnet RPC." >&2
fi

FAILED=0

ensure_txproxy_signer_funded() {
  if [[ "$SKIP_SIGNER_FUNDING" == "true" ]]; then
    echo "Skipping signer funding check (--skip-signer-funding)."
    return 0
  fi

  if [[ -z "${GAS_TRANSFER_TO:-}" && -z "${TXPROXY_SIGNER_ADDRESS:-}" ]]; then
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -Eq 'service-txproxy|txproxy'; then
      echo "Skipping signer funding check: no explicit txproxy signer address and no local txproxy container detected."
      return 0
    fi
  fi

  local min_gas="${TXPROXY_SIGNER_MIN_GAS:-30}"
  local topup_gas="${TXPROXY_SIGNER_TOPUP_GAS:-100}"
  echo "Pre-flight: ensuring txproxy signer has at least ${min_gas} GAS..."
  env \
    GAS_TRANSFER_MIN_BALANCE="$min_gas" \
    GAS_TRANSFER_AMOUNT="$topup_gas" \
    go run -tags=scripts "$SCRIPT_DIR/transfer_gas_to_signer.go"
}

run_pricefeed_watchdog() {
  if [[ "$SKIP_PRICEFEED_WATCHDOG" == "true" ]]; then
    echo "Skipping pricefeed watchdog (--skip-pricefeed-watchdog)."
    return 0
  fi

  if [[ -z "${CONTRACT_PRICEFEED_HASH:-}" ]]; then
    echo "Skipping pricefeed watchdog: CONTRACT_PRICEFEED_HASH is not configured."
    return 0
  fi

  local watchdog_symbols="${PRICEFEED_WATCH_SYMBOLS:-BTC-USD,ETH-USD,SOL-USD,XRP-USD,DOGE-USD,GAS-USD,NEO-USD}"
  local watchdog_max_staleness="${PRICEFEED_WATCH_MAX_STALENESS:-45m}"
  local watchdog_exempt="${PRICEFEED_WATCH_EXEMPT_SYMBOLS:-USDT-USD,USDC-USD}"
  echo "Pre-flight: running pricefeed availability check..."
  env \
    PRICEFEED_WATCH_SYMBOLS="$watchdog_symbols" \
    PRICEFEED_WATCH_MAX_STALENESS="$watchdog_max_staleness" \
    PRICEFEED_WATCH_EXEMPT_SYMBOLS="$watchdog_exempt" \
    go run -tags=scripts "$SCRIPT_DIR/validate_miniapp_workflows.go" --workflow=pricefeed
}

run_stats_rollup_check() {
  if [[ "$SKIP_STATS_ROLLUP_CHECK" == "true" ]]; then
    echo "Skipping stats rollup check (--skip-stats-rollup-check)."
    return 0
  fi

  if [[ -z "${SUPABASE_URL:-}" ]]; then
    echo "Skipping stats rollup check: SUPABASE_URL is not configured."
    return 0
  fi
  if [[ -z "${SUPABASE_SERVICE_KEY:-}" && -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    echo "Skipping stats rollup check: SUPABASE service key is not configured."
    return 0
  fi

  local rollup_date="${STATS_ROLLUP_DATE:-$(date -u +%F)}"
  echo "Pre-flight: verifying miniapp_stats_rollup compatibility for ${rollup_date}..."
  env STATS_ROLLUP_DATE="$rollup_date" \
    go run -tags=scripts "$SCRIPT_DIR/check_stats_rollup.go"
}

run_step() {
  local label="$1"
  shift
  echo ""
  echo "=== ${label} ==="
  if "$@"; then
    echo "✅ ${label} completed"
  else
    echo "❌ ${label} failed" >&2
    FAILED=1
  fi
}

run_step "Signer funding pre-flight" \
  ensure_txproxy_signer_funded

run_step "PriceFeed watchdog pre-flight" \
  run_pricefeed_watchdog

run_step "Stats rollup pre-flight" \
  run_stats_rollup_check

run_step "Governance (stake + vote)" \
  go run -tags=scripts "$SCRIPT_DIR/validate_miniapp_workflows.go" --workflow=governance

if [[ "$FAILED" -ne 0 ]]; then
  echo ""
  echo "One or more workflow checks failed." >&2
  exit 1
fi

echo ""
echo "All workflows completed successfully."
