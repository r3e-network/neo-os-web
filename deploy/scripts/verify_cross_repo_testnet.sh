#!/usr/bin/env bash
#
# Cross-repo Neo N3 testnet validation:
# - direct Morpheus Oracle path
# - direct AA + paymaster + relay path
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MINIAPP_ENV_FILE="${MINIAPP_ENV_FILE:-$REPO_ROOT/.env}"
MORPHEUS_DIR="${MORPHEUS_DIR:-$(cd "$REPO_ROOT/.." && pwd)/neo-morpheus-oracle}"
AA_DIR="${AA_DIR:-$(cd "$REPO_ROOT/.." && pwd)/neo-abstract-account}"
MORPHEUS_ENV_FILE="${MORPHEUS_ENV_FILE:-$MORPHEUS_DIR/.env}"
MORPHEUS_ENV_LOCAL_FILE="${MORPHEUS_ENV_LOCAL_FILE:-$MORPHEUS_DIR/.env.local}"

PAYMASTER_APP_ID="${MORPHEUS_PAYMASTER_APP_ID:-ddff154546fe22d15b65667156dd4b7c611e6093}"
PAYMASTER_ACCOUNT_ID="${PAYMASTER_ACCOUNT_ID:-0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56}"
AA_TEST_WIF="${AA_TEST_WIF:-}"
AA_CORE_HASH_TESTNET="${AA_CORE_HASH_TESTNET:-0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38}"
if [[ -z "${SKIP_PAYMASTER_ALLOWLIST_UPDATE:-}" && "$PAYMASTER_ACCOUNT_ID" == "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56" ]]; then
  SKIP_PAYMASTER_ALLOWLIST_UPDATE=1
fi

usage() {
  cat <<'EOF'
Usage: deploy/scripts/verify_cross_repo_testnet.sh

Environment overrides:
  MINIAPP_ENV_FILE         Path to neo-miniapps-platform .env
  MORPHEUS_DIR             Path to neo-morpheus-oracle repo
  AA_DIR                   Path to neo-abstract-account repo
  AA_TEST_WIF              Funded Neo N3 testnet WIF for AA relay test (required)
  MORPHEUS_PAYMASTER_APP_ID
  PAYMASTER_ACCOUNT_ID
  SKIP_PAYMASTER_ALLOWLIST_UPDATE

Notes:
  - This script validates the preferred direct Oracle / direct AA testnet path.
  - AA_TEST_WIF must control PAYMASTER_ACCOUNT_ID when using the stable allowlisted account path.
  - The stable default paymaster account path auto-enables SKIP_PAYMASTER_ALLOWLIST_UPDATE=1.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$MINIAPP_ENV_FILE" ]]; then
  echo "Missing miniapp env file: $MINIAPP_ENV_FILE" >&2
  exit 1
fi
if [[ ! -d "$MORPHEUS_DIR" ]]; then
  echo "Missing Morpheus repo: $MORPHEUS_DIR" >&2
  exit 1
fi
if [[ ! -d "$AA_DIR" ]]; then
  echo "Missing AA repo: $AA_DIR" >&2
  exit 1
fi

WORKSPACE_CONTEXT_JSON="$(
  node "$MORPHEUS_DIR/scripts/resolve-workspace-validation-context.mjs" testnet
)"

NEO_TESTNET_WIF="${NEO_TESTNET_WIF:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.neo_testnet_wif')}"
AA_TEST_WIF="${AA_TEST_WIF:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.aa_test_wif')}"
ORACLE_TEST_WIF="${ORACLE_TEST_WIF:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.oracle_test_wif')}"
ORACLE_RUNTIME_RELAYER_WIF="${ORACLE_RUNTIME_RELAYER_WIF:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.oracle_runtime_relayer_wif')}"
ORACLE_RUNTIME_RELAYER_PRIVATE_KEY="${ORACLE_RUNTIME_RELAYER_PRIVATE_KEY:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.oracle_runtime_relayer_private_key')}"
ORACLE_RUNTIME_UPDATER_WIF="${ORACLE_RUNTIME_UPDATER_WIF:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.oracle_runtime_updater_wif')}"
ORACLE_RUNTIME_UPDATER_PRIVATE_KEY="${ORACLE_RUNTIME_UPDATER_PRIVATE_KEY:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.oracle_runtime_updater_private_key')}"
ORACLE_RUNTIME_VERIFIER_WIF="${ORACLE_RUNTIME_VERIFIER_WIF:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.oracle_runtime_verifier_wif')}"
ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY="${ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.actors.oracle_runtime_verifier_private_key')}"
PHALA_API_TOKEN="$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.morpheus.runtime_token')"
PHALA_API_URL="$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.morpheus.runtime_url')"
MORPHEUS_ORACLE_HASH="$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.morpheus.oracle_hash')"
MORPHEUS_CALLBACK_HASH="$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.morpheus.callback_hash')"
AA_CORE_HASH_TESTNET="${AA_CORE_HASH_TESTNET:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.aa.core_hash_testnet')}"
PAYMASTER_APP_ID="${MORPHEUS_PAYMASTER_APP_ID:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.aa.paymaster_app_id')}"
PAYMASTER_ACCOUNT_ID="${PAYMASTER_ACCOUNT_ID:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.aa.paymaster_account_id')}"

if [[ -z "${NEO_TESTNET_WIF:-}" || "$NEO_TESTNET_WIF" == "null" ]]; then
  echo "NEO_TESTNET_WIF missing in workspace validation context" >&2
  exit 1
fi
if [[ -z "${AA_TEST_WIF:-}" || "$AA_TEST_WIF" == "null" ]]; then
  echo "AA_TEST_WIF missing in workspace validation context" >&2
  exit 1
fi
if [[ -z "${ORACLE_TEST_WIF:-}" || "$ORACLE_TEST_WIF" == "null" ]]; then
  echo "ORACLE_TEST_WIF missing in workspace validation context" >&2
  exit 1
fi
if [[ ( -z "${ORACLE_RUNTIME_UPDATER_WIF:-}" || "$ORACLE_RUNTIME_UPDATER_WIF" == "null" ) && ( -z "${ORACLE_RUNTIME_UPDATER_PRIVATE_KEY:-}" || "$ORACLE_RUNTIME_UPDATER_PRIVATE_KEY" == "null" ) ]]; then
  echo "ORACLE_RUNTIME_UPDATER signer missing in workspace validation context" >&2
  exit 1
fi
if [[ ( -z "${ORACLE_RUNTIME_VERIFIER_WIF:-}" || "$ORACLE_RUNTIME_VERIFIER_WIF" == "null" ) && ( -z "${ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY:-}" || "$ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY" == "null" ) ]]; then
  echo "ORACLE_RUNTIME_VERIFIER signer missing in workspace validation context" >&2
  exit 1
fi
if [[ -z "${PHALA_API_TOKEN:-}" || "$PHALA_API_TOKEN" == "null" ]]; then
  echo "MORPHEUS runtime token missing in workspace validation context" >&2
  exit 1
fi
if [[ -z "${PHALA_API_URL:-}" || "$PHALA_API_URL" == "null" ]]; then
  echo "MORPHEUS runtime url missing in workspace validation context" >&2
  exit 1
fi

echo ""
echo "=== Direct Oracle: neo-morpheus-oracle testnet smoke ==="
oracle_smoke_retries=3
oracle_smoke_delay_seconds=8
oracle_smoke_attempt=1
while true; do
  set +e
  oracle_smoke_output="$(
    cd "$MORPHEUS_DIR" && \
      env \
        MORPHEUS_NETWORK=testnet \
        NEO_RPC_URL=https://testnet1.neo.coz.io:443 \
        NEO_NETWORK_MAGIC=894710606 \
        MORPHEUS_SMOKE_REQUEST_WIF="$ORACLE_TEST_WIF" \
        NEO_TESTNET_WIF="$ORACLE_TEST_WIF" \
        MORPHEUS_RELAYER_NEO_N3_WIF_TESTNET="$ORACLE_RUNTIME_RELAYER_WIF" \
        MORPHEUS_RELAYER_NEO_N3_PRIVATE_KEY_TESTNET="$ORACLE_RUNTIME_RELAYER_PRIVATE_KEY" \
        MORPHEUS_UPDATER_NEO_N3_WIF_TESTNET="$ORACLE_RUNTIME_UPDATER_WIF" \
        MORPHEUS_UPDATER_NEO_N3_PRIVATE_KEY_TESTNET="$ORACLE_RUNTIME_UPDATER_PRIVATE_KEY" \
        MORPHEUS_ORACLE_VERIFIER_WIF_TESTNET="$ORACLE_RUNTIME_VERIFIER_WIF" \
        MORPHEUS_ORACLE_VERIFIER_PRIVATE_KEY_TESTNET="$ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY" \
        PHALA_ORACLE_VERIFIER_WIF_TESTNET="$ORACLE_RUNTIME_VERIFIER_WIF" \
        PHALA_ORACLE_VERIFIER_PRIVATE_KEY_TESTNET="$ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY" \
        CONTRACT_MORPHEUS_ORACLE_HASH="$MORPHEUS_ORACLE_HASH" \
        CONTRACT_ORACLE_CALLBACK_CONSUMER_HASH="$MORPHEUS_CALLBACK_HASH" \
        node scripts/smoke-oracle-n3.mjs 2>&1
  )"
  oracle_smoke_status=$?
  set -e
  printf '%s\n' "$oracle_smoke_output"

  if [[ $oracle_smoke_status -eq 0 ]]; then
    break
  fi

  if [[ $oracle_smoke_attempt -lt $oracle_smoke_retries ]] && [[ \
    "$oracle_smoke_output" == *"request_in_progress"* || \
    "$oracle_smoke_output" == *"fetch failed"* || \
    "$oracle_smoke_output" == *"timed out waiting"* \
  ]]; then
    echo "[oracle-smoke] transient oracle failure, retrying (${oracle_smoke_attempt}/${oracle_smoke_retries})..." >&2
    oracle_smoke_attempt=$((oracle_smoke_attempt + 1))
    sleep "$oracle_smoke_delay_seconds"
    continue
  fi

  exit $oracle_smoke_status
done

echo ""
echo "=== Direct AA: neo-abstract-account paymaster relay ==="
(cd "$AA_DIR" && \
  env \
    MORPHEUS_LOCAL_PAYMASTER_HANDLER_PATH="$MORPHEUS_DIR/workers/phala-worker/src/worker.js" \
    PHALA_API_URL="$PHALA_API_URL" \
    PHALA_API_TOKEN="$PHALA_API_TOKEN" \
    PHALA_SHARED_SECRET="$PHALA_API_TOKEN" \
    MORPHEUS_PAYMASTER_APP_ID="$PAYMASTER_APP_ID" \
    MORPHEUS_PAYMASTER_TESTNET_ENABLED="${MORPHEUS_PAYMASTER_TESTNET_ENABLED:-true}" \
    MORPHEUS_PAYMASTER_TESTNET_POLICY_ID="${MORPHEUS_PAYMASTER_TESTNET_POLICY_ID:-testnet-aa}" \
    MORPHEUS_PAYMASTER_TESTNET_MAX_GAS_UNITS="${MORPHEUS_PAYMASTER_TESTNET_MAX_GAS_UNITS:-5000000}" \
    MORPHEUS_PAYMASTER_TESTNET_ALLOW_TARGETS="${MORPHEUS_PAYMASTER_TESTNET_ALLOW_TARGETS:-$AA_CORE_HASH_TESTNET}" \
    MORPHEUS_PAYMASTER_TESTNET_ALLOW_METHODS="${MORPHEUS_PAYMASTER_TESTNET_ALLOW_METHODS:-executeUserOp}" \
    MORPHEUS_PAYMASTER_TESTNET_ALLOW_ACCOUNTS="${MORPHEUS_PAYMASTER_TESTNET_ALLOW_ACCOUNTS:-$PAYMASTER_ACCOUNT_ID}" \
    MORPHEUS_PAYMASTER_TESTNET_ALLOW_DAPPS="${MORPHEUS_PAYMASTER_TESTNET_ALLOW_DAPPS:-demo-dapp}" \
    TEST_WIF="$AA_TEST_WIF" \
    TESTNET_RPC_URL=https://testnet1.neo.coz.io:443 \
    PAYMASTER_ACCOUNT_ID="$PAYMASTER_ACCOUNT_ID" \
    ${SKIP_PAYMASTER_ALLOWLIST_UPDATE:+SKIP_PAYMASTER_ALLOWLIST_UPDATE=$SKIP_PAYMASTER_ALLOWLIST_UPDATE} \
    node sdk/js/tests/v3_testnet_paymaster_relay.mjs)

echo ""
echo "Cross-repo testnet validation completed successfully."
