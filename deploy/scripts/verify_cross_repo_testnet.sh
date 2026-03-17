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

PAYMASTER_APP_ID="${MORPHEUS_PAYMASTER_APP_ID:-28294e89d490924b79c85cdee057ce55723b3d56}"
PAYMASTER_ACCOUNT_ID="${PAYMASTER_ACCOUNT_ID:-0x37298bb6bbb4580fdca24903d67b385ef2268e25}"
AA_TEST_WIF="${AA_TEST_WIF:-}"
if [[ -z "${SKIP_PAYMASTER_ALLOWLIST_UPDATE:-}" && "$PAYMASTER_ACCOUNT_ID" == "0x37298bb6bbb4580fdca24903d67b385ef2268e25" ]]; then
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

load_env_key() {
  local file="$1"
  local key="$2"
  node - <<'NODE' "$file" "$key"
const fs = require('fs');
const file = process.argv[2];
const key = process.argv[3];
const text = fs.readFileSync(file, 'utf8');
for (const line of text.split(/\n/)) {
  const s = line.trim();
  if (!s || s.startsWith('#') || !s.includes('=')) continue;
  const idx = s.indexOf('=');
  if (s.slice(0, idx) === key) {
    process.stdout.write(s.slice(idx + 1));
    process.exit(0);
  }
}
process.exit(0);
NODE
}

set -a
source "$MINIAPP_ENV_FILE"
set +a

if [[ -z "${NEO_TESTNET_WIF:-}" ]]; then
  echo "NEO_TESTNET_WIF missing in $MINIAPP_ENV_FILE" >&2
  exit 1
fi

ORACLE_TEST_WIF="${ORACLE_TEST_WIF:-${AA_TEST_WIF:-${FLAGSHIP_LIVE_WIF:-${NEO_TESTNET_WIF}}}}"

PHALA_API_TOKEN="$(load_env_key "$MORPHEUS_DIR/.env" PHALA_API_TOKEN)"
if [[ -z "$PHALA_API_TOKEN" ]]; then
  PHALA_API_TOKEN="$(load_env_key "$MORPHEUS_DIR/.env" PHALA_SHARED_SECRET)"
fi
if [[ -z "$PHALA_API_TOKEN" ]]; then
  echo "PHALA_API_TOKEN / PHALA_SHARED_SECRET missing in $MORPHEUS_DIR/.env" >&2
  exit 1
fi

if [[ -z "$AA_TEST_WIF" ]]; then
  echo "AA_TEST_WIF is required for the direct AA relay validation" >&2
  echo "AA_TEST_WIF must control PAYMASTER_ACCOUNT_ID ($PAYMASTER_ACCOUNT_ID) when using the stable allowlisted account path" >&2
  exit 1
fi

MORPHEUS_ORACLE_HASH="$(jq -r '.neo_n3.contracts.morpheus_oracle' "$MORPHEUS_DIR/config/networks/testnet.json")"
MORPHEUS_CALLBACK_HASH="$(jq -r '.neo_n3.examples.oracle_callback_consumer' "$MORPHEUS_DIR/config/networks/testnet.json")"

echo ""
echo "=== Direct Oracle: neo-morpheus-oracle testnet smoke ==="
(cd "$MORPHEUS_DIR" && \
  env \
    MORPHEUS_NETWORK=testnet \
    NEO_RPC_URL=https://testnet1.neo.coz.io:443 \
    NEO_NETWORK_MAGIC=894710606 \
    NEO_N3_WIF="$ORACLE_TEST_WIF" \
    NEO_TESTNET_WIF="$ORACLE_TEST_WIF" \
    CONTRACT_MORPHEUS_ORACLE_HASH="$MORPHEUS_ORACLE_HASH" \
    CONTRACT_ORACLE_CALLBACK_CONSUMER_HASH="$MORPHEUS_CALLBACK_HASH" \
    node scripts/smoke-oracle-n3.mjs)

echo ""
echo "=== Direct AA: neo-abstract-account paymaster relay ==="
(cd "$AA_DIR" && \
  env \
    PHALA_API_TOKEN="$PHALA_API_TOKEN" \
    PHALA_SHARED_SECRET="$PHALA_API_TOKEN" \
    MORPHEUS_PAYMASTER_APP_ID="$PAYMASTER_APP_ID" \
    TEST_WIF="$AA_TEST_WIF" \
    TESTNET_RPC_URL=https://testnet1.neo.coz.io:443 \
    PAYMASTER_ACCOUNT_ID="$PAYMASTER_ACCOUNT_ID" \
    ${SKIP_PAYMASTER_ALLOWLIST_UPDATE:+SKIP_PAYMASTER_ALLOWLIST_UPDATE=$SKIP_PAYMASTER_ALLOWLIST_UPDATE} \
    node sdk/js/tests/v3_testnet_paymaster_relay.mjs)

echo ""
echo "Cross-repo testnet validation completed successfully."
