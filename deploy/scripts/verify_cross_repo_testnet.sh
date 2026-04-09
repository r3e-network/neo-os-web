#!/usr/bin/env bash
#
# Cross-repo Neo N3 testnet validation:
# - direct Morpheus Oracle path
# - direct AA + paymaster + relay path
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_CANONICAL_ROOT="$REPO_ROOT"
WORKTREE_NAME=""
if [[ "$REPO_ROOT" == */.worktrees/* ]]; then
  REPO_CANONICAL_ROOT="${REPO_ROOT%/.worktrees/*}"
  WORKTREE_NAME="${REPO_ROOT#"$REPO_CANONICAL_ROOT"/.worktrees/}"
fi
WORKSPACE_ROOT="$(cd "$REPO_CANONICAL_ROOT/.." && pwd)"

resolve_sibling_repo_root() {
  local repo_name="$1"
  local canonical_root="$WORKSPACE_ROOT/$repo_name"
  local worktree_root="$canonical_root/.worktrees/$WORKTREE_NAME"
  if [[ -n "$WORKTREE_NAME" && -d "$worktree_root" ]]; then
    printf "%s\n" "$worktree_root"
    return
  fi
  printf "%s\n" "$canonical_root"
}

pick_env_file() {
  local repo_root="$1"
  local canonical_root="$2"
  local filename="$3"
  if [[ -f "$repo_root/$filename" ]]; then
    printf "%s\n" "$repo_root/$filename"
    return
  fi
  printf "%s\n" "$canonical_root/$filename"
}

MINIAPP_ENV_FILE="${MINIAPP_ENV_FILE:-$(pick_env_file "$REPO_ROOT" "$REPO_CANONICAL_ROOT" ".env")}"
MORPHEUS_DIR="${MORPHEUS_DIR:-$(resolve_sibling_repo_root neo-morpheus-oracle)}"
AA_DIR="${AA_DIR:-$(resolve_sibling_repo_root neo-abstract-account)}"
MORPHEUS_CANONICAL_ROOT="$MORPHEUS_DIR"
if [[ "$MORPHEUS_DIR" == */.worktrees/* ]]; then
  MORPHEUS_CANONICAL_ROOT="${MORPHEUS_DIR%/.worktrees/*}"
fi
MORPHEUS_ENV_FILE="${MORPHEUS_ENV_FILE:-$(pick_env_file "$MORPHEUS_DIR" "$MORPHEUS_CANONICAL_ROOT" ".env")}"
MORPHEUS_ENV_LOCAL_FILE="${MORPHEUS_ENV_LOCAL_FILE:-$(pick_env_file "$MORPHEUS_DIR" "$MORPHEUS_CANONICAL_ROOT" ".env.local")}"

PAYMASTER_APP_ID="${MORPHEUS_PAYMASTER_APP_ID:-ddff154546fe22d15b65667156dd4b7c611e6093}"
PAYMASTER_ACCOUNT_ID="${PAYMASTER_ACCOUNT_ID:-0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56}"
AA_TEST_WIF="${AA_TEST_WIF:-}"
AA_CORE_HASH_TESTNET="${AA_CORE_HASH_TESTNET:-0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38}"
ORACLE_SMOKE_PROVIDER="${MORPHEUS_SMOKE_PROVIDER:-twelvedata}"
ORACLE_SMOKE_SYMBOL="${MORPHEUS_SMOKE_SYMBOL:-NEO-USD}"
ORACLE_SMOKE_JSON_PATH="${MORPHEUS_SMOKE_JSON_PATH:-}"
if [[ -z "${SKIP_PAYMASTER_ALLOWLIST_UPDATE:-}" && "$PAYMASTER_ACCOUNT_ID" == "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56" ]]; then
  SKIP_PAYMASTER_ALLOWLIST_UPDATE=1
fi

if [[ -z "$ORACLE_SMOKE_JSON_PATH" ]]; then
  case "$ORACLE_SMOKE_PROVIDER" in
    coinbase-spot)
      ORACLE_SMOKE_JSON_PATH="data.amount"
      ;;
    *)
      ORACLE_SMOKE_JSON_PATH="price"
      ;;
  esac
fi

verify_runtime_catalog_contract() {
  local runtime_catalog_file="$1"
  local checked_catalog="$MORPHEUS_DIR/apps/web/public/morpheus-runtime-catalog.json"
  local platform_catalog="$REPO_ROOT/apps/shared/constants/generated-morpheus-runtime-catalog.ts"
  local aa_catalog="$AA_DIR/frontend/src/config/generatedMorpheusRuntimeCatalog.js"

  echo ""
  echo "=== Runtime Catalog Contract Validation ==="

  node "$MORPHEUS_DIR/scripts/export-public-runtime-catalog.mjs" --output "$runtime_catalog_file" >/dev/null

  if ! cmp -s "$runtime_catalog_file" "$checked_catalog"; then
    echo "Checked-in Morpheus runtime catalog is stale: $checked_catalog" >&2
    exit 1
  fi

  local envelope_version
  envelope_version="$(jq -r '.envelope.version' "$runtime_catalog_file")"
  mapfile -t workflow_ids < <(jq -r '.workflows[].id' "$runtime_catalog_file")

  for consumer_catalog in "$platform_catalog" "$aa_catalog"; do
    if [[ ! -s "$consumer_catalog" ]]; then
      echo "Missing runtime catalog consumer artifact: $consumer_catalog" >&2
      exit 1
    fi
    if ! grep -q "$envelope_version" "$consumer_catalog"; then
      echo "Runtime catalog consumer is missing envelope version $envelope_version: $consumer_catalog" >&2
      exit 1
    fi
    for workflow_id in "${workflow_ids[@]}"; do
      if ! grep -q "\"$workflow_id\"" "$consumer_catalog"; then
        echo "Runtime catalog consumer is missing workflow $workflow_id: $consumer_catalog" >&2
        exit 1
      fi
    done
  done
}

usage() {
  cat <<'USAGE'
Usage: deploy/scripts/verify_cross_repo_testnet.sh

Environment overrides:
  MINIAPP_ENV_FILE         Path to neo-miniapps-platform .env
  MORPHEUS_DIR             Path to neo-morpheus-oracle repo
  AA_DIR                   Path to neo-abstract-account repo
  AA_TEST_WIF              Funded Neo N3 testnet WIF for AA relay test (required)
  MORPHEUS_PAYMASTER_APP_ID
  PAYMASTER_ACCOUNT_ID
  SKIP_PAYMASTER_ALLOWLIST_UPDATE
  NEO_RPC_TESTNET         Optional Neo N3 testnet RPC override used by both direct checks

Notes:
  - This script validates the preferred direct Oracle / direct AA testnet path.
  - AA_TEST_WIF must control PAYMASTER_ACCOUNT_ID when using the stable allowlisted account path.
  - The stable default paymaster account path auto-enables SKIP_PAYMASTER_ALLOWLIST_UPDATE=1.
USAGE
}

load_env_defaults() {
  local env_file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    if [[ -n "${!key:-}" ]]; then
      continue
    fi
    export "$key=$value"
  done < "$env_file"
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

WORKSPACE_SECRETS_ENV_FILE="$(mktemp "${TMPDIR:-/tmp}/cross-repo-testnet-secrets.XXXXXX.env")"
WORKSPACE_RUNTIME_CATALOG_FILE="$(mktemp "${TMPDIR:-/tmp}/cross-repo-runtime-catalog.XXXXXX.json")"
cleanup() {
  rm -f "$WORKSPACE_SECRETS_ENV_FILE" "$WORKSPACE_RUNTIME_CATALOG_FILE"
}
trap cleanup EXIT

WORKSPACE_CONTEXT_JSON="$({
  MINIAPP_ENV_FILE="$MINIAPP_ENV_FILE" \
  MORPHEUS_ENV_FILE="$MORPHEUS_ENV_FILE" \
  MORPHEUS_ENV_LOCAL_FILE="$MORPHEUS_ENV_LOCAL_FILE" \
  node "$MORPHEUS_DIR/scripts/resolve-workspace-validation-context.mjs" \
    testnet \
    --write-secret-env-file "$WORKSPACE_SECRETS_ENV_FILE"
})"

if [[ ! -s "$WORKSPACE_SECRETS_ENV_FILE" ]]; then
  echo "Workspace validation secrets env file was not created." >&2
  exit 1
fi

load_env_defaults "$WORKSPACE_SECRETS_ENV_FILE"
verify_runtime_catalog_contract "$WORKSPACE_RUNTIME_CATALOG_FILE"

NEO_TESTNET_WIF="${NEO_TESTNET_WIF:-}"
AA_TEST_WIF="${AA_TEST_WIF:-}"
ORACLE_TEST_WIF="${ORACLE_TEST_WIF:-}"
ORACLE_RUNTIME_RELAYER_WIF="${ORACLE_RUNTIME_RELAYER_WIF:-}"
ORACLE_RUNTIME_RELAYER_PRIVATE_KEY="${ORACLE_RUNTIME_RELAYER_PRIVATE_KEY:-}"
ORACLE_RUNTIME_UPDATER_WIF="${ORACLE_RUNTIME_UPDATER_WIF:-}"
ORACLE_RUNTIME_UPDATER_PRIVATE_KEY="${ORACLE_RUNTIME_UPDATER_PRIVATE_KEY:-}"
ORACLE_RUNTIME_VERIFIER_WIF="${ORACLE_RUNTIME_VERIFIER_WIF:-}"
ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY="${ORACLE_RUNTIME_VERIFIER_PRIVATE_KEY:-}"
PHALA_API_TOKEN="${PHALA_API_TOKEN:-${MORPHEUS_RUNTIME_TOKEN:-}}"
PHALA_API_URL="${PHALA_API_URL:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.morpheus.runtime_url')}"
MORPHEUS_ORACLE_HASH="${MORPHEUS_ORACLE_HASH:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.morpheus.oracle_hash')}"
MORPHEUS_CALLBACK_HASH="${MORPHEUS_CALLBACK_HASH:-$(printf '%s' "$WORKSPACE_CONTEXT_JSON" | jq -r '.morpheus.callback_hash')}"
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

NEO_N3_TESTNET_RPC_URL="${NEO_RPC_TESTNET:-${NEO_RPC_URL:-https://testnet1.neo.coz.io:443}}"
AA_TESTNET_RPC_URL="${TESTNET_RPC_URL:-$NEO_N3_TESTNET_RPC_URL}"

echo ""
echo "=== Direct Oracle: neo-morpheus-oracle testnet smoke ==="
oracle_smoke_retries=3
oracle_smoke_delay_seconds=8
oracle_smoke_attempt=1
while true; do
  set +e
  oracle_smoke_output="$({
    cd "$MORPHEUS_DIR" && \
      env \
        MORPHEUS_NETWORK=testnet \
        NEO_RPC_URL="$NEO_N3_TESTNET_RPC_URL" \
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
        MORPHEUS_SMOKE_PROVIDER="$ORACLE_SMOKE_PROVIDER" \
        MORPHEUS_SMOKE_SYMBOL="$ORACLE_SMOKE_SYMBOL" \
        MORPHEUS_SMOKE_JSON_PATH="$ORACLE_SMOKE_JSON_PATH" \
        node scripts/smoke-oracle-n3.mjs 2>&1
  })"
  oracle_smoke_status=$?
  set -e
  printf '%s\n' "$oracle_smoke_output"

  if [[ $oracle_smoke_status -eq 0 ]]; then
    break
  fi

  if [[ $oracle_smoke_attempt -lt $oracle_smoke_retries ]] && [[ \
    "$oracle_smoke_output" == *"request_in_progress"* || \
    "$oracle_smoke_output" == *"fetch failed"* || \
    "$oracle_smoke_output" == *"timed out waiting"* || \
    "$oracle_smoke_output" == *"ECONNRESET"* || \
    "$oracle_smoke_output" == *"Client network socket disconnected"* || \
    "$oracle_smoke_output" == *"SSL_ERROR_SYSCALL"* \
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
    TESTNET_RPC_URL="$AA_TESTNET_RPC_URL" \
    PAYMASTER_ACCOUNT_ID="$PAYMASTER_ACCOUNT_ID" \
    ${SKIP_PAYMASTER_ALLOWLIST_UPDATE:+SKIP_PAYMASTER_ALLOWLIST_UPDATE=$SKIP_PAYMASTER_ALLOWLIST_UPDATE} \
    node sdk/js/tests/v3_testnet_paymaster_relay.mjs)

echo ""
echo "Cross-repo testnet validation completed successfully."
