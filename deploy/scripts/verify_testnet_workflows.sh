#!/bin/bash
#
# Verify end-to-end MiniApp workflows on Neo N3 testnet.
# Runs: PaymentHub GAS, Governance workflow, ServiceGateway RNG callback, Oracle callback, Compute callback.
#
set -euo pipefail

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
Usage: ./scripts/verify_testnet_workflows.sh [OPTIONS]

Options:
  --env-file <path>       Path to env file (default: .env)
  --miniapp-hash <hash>   MiniApp callback contract hash (overrides env)
  --app-id <id>           MiniApp app_id (default: miniapp-lottery)
  --no-wait-callback      Do not wait for on-chain callbacks
  --skip-signer-funding   Skip pre-flight txproxy signer funding check
  --skip-pricefeed-watchdog
                          Skip pre-flight pricefeed freshness watchdog
  --skip-stats-rollup-check
                          Skip pre-flight miniapp stats rollup compatibility check
  --callback-timeout <s>  Callback wait timeout in seconds (default: 300)
  -h, --help              Show this help

This script sends real testnet transactions.
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

if [[ -n "$MINIAPP_HASH" ]]; then
  export MINIAPP_CALLBACK_CONTRACT_HASH="$MINIAPP_HASH"
  export MINIAPP_CONSUMER_HASH="$MINIAPP_HASH"
fi
if [[ -n "$APP_ID" ]]; then
  export MINIAPP_APP_ID="$APP_ID"
fi
if [[ -z "${MINIAPP_APP_ID:-}" ]]; then
  export MINIAPP_APP_ID="miniapp-lottery"
fi

resolve_miniapp_hash() {
  if [[ -n "${MINIAPP_CALLBACK_CONTRACT_HASH:-}" ]]; then
    echo "$MINIAPP_CALLBACK_CONTRACT_HASH"
    return 0
  fi
  if [[ -n "${MINIAPP_CONSUMER_HASH:-}" ]]; then
    echo "$MINIAPP_CONSUMER_HASH"
    return 0
  fi
  if [[ -n "${MINIAPP_CONTRACT_HASH:-}" ]]; then
    echo "$MINIAPP_CONTRACT_HASH"
    return 0
  fi
  if [[ -n "${CONTRACT_MINIAPP_CONSUMER_HASH:-}" ]]; then
    echo "$CONTRACT_MINIAPP_CONSUMER_HASH"
    return 0
  fi
  if command -v jq >/dev/null 2>&1 && [[ -f "contracts/build/miniapp_consumer_deployed_live.json" ]]; then
    local deployed_consumer
    deployed_consumer="$(jq -r '.hash // empty' contracts/build/miniapp_consumer_deployed_live.json | head -n 1)"
    if [[ -n "$deployed_consumer" ]]; then
      echo "$deployed_consumer"
      return 0
    fi
  fi
  if command -v jq >/dev/null 2>&1 && [[ -f "contracts/build/miniapps_deployed_live.json" ]]; then
    local fallback
    fallback="$(jq -r '.[] | select(.name=="MiniAppServiceConsumer") | .hash // empty' contracts/build/miniapps_deployed_live.json | head -n 1)"
    if [[ -n "$fallback" ]]; then
      echo "$fallback"
      return 0
    fi
    fallback="$(jq -r '.[] | select(.name=="MiniAppLottery") | .hash // empty' contracts/build/miniapps_deployed_live.json | head -n 1)"
    if [[ -n "$fallback" ]]; then
      echo "$fallback"
      return 0
    fi
  fi
  return 1
}

missing=()
require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
}

require_env "NEO_TESTNET_WIF"
require_env "CONTRACT_PAYMENTHUB_HASH"
require_env "CONTRACT_GOVERNANCE_HASH"
require_env "CONTRACT_SERVICEGATEWAY_HASH"
require_env "CONTRACT_APPREGISTRY_HASH"

if ! resolve_miniapp_hash >/dev/null; then
  missing+=("MINIAPP_CALLBACK_CONTRACT_HASH")
fi

if [[ "${#missing[@]}" -gt 0 ]]; then
  echo "Missing required environment variables:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

if [[ -z "${NEO_RPC_URL:-}" ]]; then
  echo "Warning: NEO_RPC_URL not set; scripts will default to testnet RPC." >&2
fi

export MINIAPP_CALLBACK_CONTRACT_HASH="$(resolve_miniapp_hash)"
export MINIAPP_CONSUMER_HASH="${MINIAPP_CONSUMER_HASH:-$MINIAPP_CALLBACK_CONTRACT_HASH}"

FAILED=0

ensure_txproxy_signer_funded() {
  if [[ "$SKIP_SIGNER_FUNDING" == "true" ]]; then
    echo "Skipping signer funding check (--skip-signer-funding)."
    return 0
  fi

  local min_gas="${TXPROXY_SIGNER_MIN_GAS:-30}"
  local topup_gas="${TXPROXY_SIGNER_TOPUP_GAS:-100}"
  echo "Pre-flight: ensuring txproxy signer has at least ${min_gas} GAS..."
  env \
    GAS_TRANSFER_MIN_BALANCE="$min_gas" \
    GAS_TRANSFER_AMOUNT="$topup_gas" \
    go run -tags=scripts scripts/transfer_gas_to_signer.go
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
  echo "Pre-flight: running pricefeed freshness watchdog..."
  env \
    PRICEFEED_WATCH_SYMBOLS="$watchdog_symbols" \
    PRICEFEED_WATCH_MAX_STALENESS="$watchdog_max_staleness" \
    PRICEFEED_WATCH_EXEMPT_SYMBOLS="$watchdog_exempt" \
    go run -tags=scripts scripts/check_pricefeed_freshness.go
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
    go run -tags=scripts scripts/check_stats_rollup.go
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

run_step "PaymentHub GAS flow" \
  go run scripts/send_paymenthub_gas.go

run_step "Governance (stake + vote)" \
  go run scripts/test_governance_flow.go

run_step "MiniApp RNG callback (via ServiceGateway)" \
  env MINIAPP_WAIT_CALLBACK="$WAIT_CALLBACK" \
    MINIAPP_CALLBACK_TIMEOUT_SECONDS="$CALLBACK_TIMEOUT_SECONDS" \
    go run scripts/request_miniapp_rng.go

run_step "MiniApp Oracle callback (via ServiceGateway)" \
  env MINIAPP_SERVICE_TYPE="oracle" \
    MINIAPP_SERVICE_PAYLOAD="" \
    MINIAPP_WAIT_CALLBACK="$WAIT_CALLBACK" \
    MINIAPP_CALLBACK_TIMEOUT_SECONDS="$CALLBACK_TIMEOUT_SECONDS" \
    go run scripts/request_miniapp_service.go

run_step "MiniApp Compute callback (via ServiceGateway)" \
  env MINIAPP_SERVICE_TYPE="compute" \
    MINIAPP_SERVICE_PAYLOAD="" \
    MINIAPP_WAIT_CALLBACK="$WAIT_CALLBACK" \
    MINIAPP_CALLBACK_TIMEOUT_SECONDS="$CALLBACK_TIMEOUT_SECONDS" \
    go run scripts/request_miniapp_service.go

if [[ "$FAILED" -ne 0 ]]; then
  echo ""
  echo "One or more workflow checks failed." >&2
  exit 1
fi

echo ""
echo "All workflows completed successfully."
