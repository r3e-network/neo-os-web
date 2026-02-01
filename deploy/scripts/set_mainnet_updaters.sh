#!/bin/bash
# Set updater for platform-write contracts on Neo N3 mainnet.
# Requires NEO_MAINNET_TEE_ADDRESS (or another updater address) to be set.

set -euo pipefail

RPC_URL="${NEO_MAINNET_RPC:-https://mainnet1.neo.coz.io:443}"
WALLET_CONFIG="${MAINNET_WALLET_CONFIG:-/home/neo/git/service_layer/deploy/mainnet/wallets/wallet-config.yaml}"
UPDATER_ADDRESS="${NEO_MAINNET_TEE_ADDRESS:-}"
SIGNER_ADDRESS="${NEO_MAINNET_ADDRESS:-}"

if [[ -z "$UPDATER_ADDRESS" ]]; then
  echo "Error: NEO_MAINNET_TEE_ADDRESS is required (Updater Hash160/Address)." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to read deploy/config/mainnet_contracts.json" >&2
  exit 1
fi

CONFIG_PATH="/home/neo/git/service_layer/deploy/config/mainnet_contracts.json"

get_contract() {
  local name="$1"
  jq -r --arg name "$name" '.contracts[$name].address // empty' "$CONFIG_PATH"
}

invoke_set_updater() {
  local name="$1"
  local hash="$2"
  if [[ -z "$hash" ]]; then
    echo "  - ${name}: missing address, skipping"
    return
  fi
  echo "  - ${name}.setUpdater(${UPDATER_ADDRESS})"
  neo-go contract invokefunction \
    -r "$RPC_URL" \
    --wallet-config "$WALLET_CONFIG" \
    ${SIGNER_ADDRESS:+--address "$SIGNER_ADDRESS"} \
    --force \
    --await \
    "$hash" \
    setUpdater \
    "hash160:${UPDATER_ADDRESS}" \
    -- \
    "${SIGNER_ADDRESS:-$UPDATER_ADDRESS}:CalledByEntry"
}

echo "=== Setting mainnet updaters ==="
echo "RPC: ${RPC_URL}"
echo "Updater: ${UPDATER_ADDRESS}"
if [[ -n "$SIGNER_ADDRESS" ]]; then
  echo "Signer: ${SIGNER_ADDRESS}"
fi

invoke_set_updater "PriceFeed" "$(get_contract PriceFeed)"
invoke_set_updater "RandomnessLog" "$(get_contract RandomnessLog)"
invoke_set_updater "AutomationAnchor" "$(get_contract AutomationAnchor)"
invoke_set_updater "ServiceLayerGateway" "$(get_contract ServiceLayerGateway)"

echo "=== Done ==="
