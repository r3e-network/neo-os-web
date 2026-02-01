#!/bin/bash
# Update all MiniApp contracts on Neo MainNet
# This script updates existing contracts without redeploying
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
CONFIG_FILE="$PROJECT_ROOT/deploy/config/mainnet_contracts.json"
WALLET_FILE="$PROJECT_ROOT/deploy/mainnet/wallets/mainnet.json"
WALLET_CONFIG="$PROJECT_ROOT/deploy/mainnet/wallets/wallet-config.yaml"
RPC_ENDPOINT="https://mainnet1.neo.coz.io:443"
UPDATE_SCOPE="${UPDATE_SCOPE:-all}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Neo MiniApp Platform Contract Update (MainNet) ==="
echo "Build directory: $BUILD_DIR"
echo "Config file: $CONFIG_FILE"
echo "Wallet: $WALLET_FILE"
echo "RPC: $RPC_ENDPOINT"
echo ""

# Check prerequisites
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Config file not found: $CONFIG_FILE${NC}"
    exit 1
fi

if [ ! -f "$WALLET_FILE" ]; then
    echo -e "${RED}Error: Wallet file not found: $WALLET_FILE${NC}"
    exit 1
fi

if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}Error: Build directory not found: $BUILD_DIR${NC}"
    echo "Run ./build.sh first to compile contracts"
    exit 1
fi

# Check for neo-go
if ! command -v neo-go &> /dev/null; then
    echo -e "${RED}Error: neo-go not found in PATH${NC}"
    echo "Install neo-go: go install github.com/nspcc-dev/neo-go/cli/neo-go@latest"
    exit 1
fi

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq not found in PATH${NC}"
    echo "Install jq: sudo apt install jq"
    exit 1
fi

# Check for curl
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl not found in PATH${NC}"
    echo "Install curl: sudo apt install curl"
    exit 1
fi

SIGNER_ADDRESS=$(jq -r '.accounts[] | select(.isDefault==true) | .address' "$WALLET_FILE" | head -1)
if [ -z "$SIGNER_ADDRESS" ]; then
    SIGNER_ADDRESS=$(jq -r '.accounts[0].address' "$WALLET_FILE")
fi
if [ -z "$SIGNER_ADDRESS" ] || [ "$SIGNER_ADDRESS" = "null" ]; then
    echo -e "${RED}Error: No signer address found in wallet${NC}"
    exit 1
fi

# Counters
UPDATED=0
SKIPPED=0
FAILED=0

# Mapping for contracts with different names in build vs config
declare -A NAME_MAPPING=(
    ["PaymentHub"]="PaymentHubV2"
)

# Function to update a single contract
update_contract() {
    local name=$1
    local hash=$2
    local status=${3:-deployed}
    local build_name="${NAME_MAPPING[$name]:-$name}"
    local nef_file="$BUILD_DIR/${build_name}.nef"
    local manifest_file="$BUILD_DIR/${build_name}.manifest.json"

    if [ "$status" != "deployed" ]; then
        echo -e "  ${YELLOW}[SKIP]${NC} $name - status is $status"
        ((SKIPPED++))
        return 0
    fi

    if [ ! -f "$nef_file" ]; then
        echo -e "  ${YELLOW}[SKIP]${NC} $name - NEF file not found"
        ((SKIPPED++))
        return 0
    fi

    if [ ! -f "$manifest_file" ]; then
        echo -e "  ${YELLOW}[SKIP]${NC} $name - Manifest file not found"
        ((SKIPPED++))
        return 0
    fi

    update_info=$(curl -s -X POST -H 'Content-Type: application/json' \
        --data '{"jsonrpc":"2.0","id":1,"method":"getcontractstate","params":["'"$hash"'"]}' \
        "$RPC_ENDPOINT" | jq -c '.result.manifest.abi.methods[]? | select(.name=="update") | {count:(.parameters|length), names:[.parameters[].name|ascii_downcase]} ' | head -1 || true)

    if [ -z "$update_info" ]; then
        echo -e "  ${YELLOW}[SKIP]${NC} $name - on-chain update method not found"
        ((SKIPPED++))
        return 0
    fi

    update_count=$(echo "$update_info" | jq -r '.count')
    has_nef=$(echo "$update_info" | jq -r '.names | map(test("nef")) | any')
    has_manifest=$(echo "$update_info" | jq -r '.names | map(test("manifest")) | any')

    if [ "$update_count" -lt 2 ] || [ "$update_count" -gt 3 ] || [ "$has_nef" != "true" ] || [ "$has_manifest" != "true" ]; then
        echo -e "  ${YELLOW}[SKIP]${NC} $name - update is not a contract upgrade method"
        ((SKIPPED++))
        return 0
    fi

    echo -n "  Updating $name ($hash)... "

    # Execute update command (scripthash is positional argument)
    if [ "$update_count" -eq 2 ]; then
        manifest_json=$(cat "$manifest_file")
        set +e
        output=$(neo-go contract invokefunction \
            -r "$RPC_ENDPOINT" \
            --wallet-config "$WALLET_CONFIG" \
            --address "$SIGNER_ADDRESS" \
            --force \
            --await \
            "$hash" update filebytes:"$nef_file" string:"$manifest_json" -- "$SIGNER_ADDRESS:Global" 2>&1)
        status=$?
        set -e
    else
        set +e
        output=$(neo-go contract update \
            --in "$nef_file" \
            --manifest "$manifest_file" \
            --wallet-config "$WALLET_CONFIG" \
            --address "$SIGNER_ADDRESS" \
            -r "$RPC_ENDPOINT" \
            --force \
            --await \
            "$hash" -- "$SIGNER_ADDRESS:Global" 2>&1)
        status=$?
        set -e
    fi

    if [ $status -ne 0 ] || echo "$output" | grep -Eq "VMState:[[:space:]]*FAULT|FAULT VM state"; then
        echo "$output"
        echo -e "${RED}[FAILED]${NC}"
        ((FAILED++))
        return 1
    fi

    echo -e "${GREEN}[OK]${NC}"
    ((UPDATED++))
    return 0
}

if [ "$UPDATE_SCOPE" != "miniapps" ]; then
    echo "=== Updating Platform Contracts ==="
    for name in $(jq -r '.contracts | keys[]' "$CONFIG_FILE"); do
        hash=$(jq -r ".contracts[\"$name\"].address" "$CONFIG_FILE")
        status=$(jq -r ".contracts[\"$name\"].status // \"deployed\"" "$CONFIG_FILE")
        if [ "$hash" != "null" ] && [ -n "$hash" ]; then
            update_contract "$name" "$hash" "$status" || true
        fi
    done
    echo ""
fi

if [ "$UPDATE_SCOPE" != "platform" ]; then
    echo "=== Updating MiniApp Contracts ==="
    for name in $(jq -r '.miniapp_contracts | keys[]' "$CONFIG_FILE"); do
        hash=$(jq -r ".miniapp_contracts[\"$name\"].address" "$CONFIG_FILE")
        status=$(jq -r ".miniapp_contracts[\"$name\"].status // \"deployed\"" "$CONFIG_FILE")
        if [ "$hash" != "null" ] && [ -n "$hash" ]; then
            update_contract "$name" "$hash" "$status" || true
        fi
    done
    echo ""
fi

echo ""
echo "=== Update Summary ==="
echo -e "  ${GREEN}Updated:${NC} $UPDATED"
echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some contracts failed to update. Check the output above.${NC}"
    exit 1
fi

echo -e "${GREEN}All contracts updated successfully!${NC}"
