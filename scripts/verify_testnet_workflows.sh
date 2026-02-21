#!/bin/bash
#
# Verify end-to-end MiniApp workflows on Neo N3 testnet.
# Runs: PaymentHub GAS, Governance (stake+vote), RNG callback, Oracle callback, Compute callback.
#
set -euo pipefail

ENV_FILE=".env"
MINIAPP_HASH=""
APP_ID=""
WAIT_CALLBACK="true"
CALLBACK_TIMEOUT_SECONDS="180"

usage() {
  cat <<'EOF'
Usage: ./scripts/verify_testnet_workflows.sh [OPTIONS]

Options:
  --env-file <path>       Path to env file (default: .env)
  --miniapp-hash <hash>   MiniApp consumer contract hash (overrides env)
  --app-id <id>           MiniApp app_id (default: com.test.consumer)
  --no-wait-callback      Do not wait for on-chain callbacks
  --callback-timeout <s>  Callback wait timeout in seconds (default: 180)
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
  export MINIAPP_CONSUMER_HASH="$MINIAPP_HASH"
fi
if [[ -n "$APP_ID" ]]; then
  export MINIAPP_APP_ID="$APP_ID"
fi

resolve_miniapp_hash() {
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
  missing+=("MINIAPP_CONSUMER_HASH")
fi

if [[ "${#missing[@]}" -gt 0 ]]; then
  echo "Missing required environment variables:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

if [[ -z "${NEO_RPC_URL:-}" ]]; then
  echo "Warning: NEO_RPC_URL not set; scripts will default to testnet RPC." >&2
fi

FAILED=0

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

run_step "PaymentHub GAS flow" \
  go run scripts/send_paymenthub_gas.go

run_step "Governance (stake + vote)" \
  go run scripts/test_governance_flow.go

run_step "MiniApp RNG callback" \
  env MINIAPP_WAIT_CALLBACK="$WAIT_CALLBACK" \
    MINIAPP_CALLBACK_TIMEOUT_SECONDS="$CALLBACK_TIMEOUT_SECONDS" \
    go run scripts/request_miniapp_rng.go

run_step "MiniApp Oracle callback" \
  env MINIAPP_SERVICE_TYPE="oracle" \
    MINIAPP_SERVICE_PAYLOAD="" \
    MINIAPP_WAIT_CALLBACK="$WAIT_CALLBACK" \
    MINIAPP_CALLBACK_TIMEOUT_SECONDS="$CALLBACK_TIMEOUT_SECONDS" \
    go run scripts/request_miniapp_service.go

run_step "MiniApp Compute callback" \
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
