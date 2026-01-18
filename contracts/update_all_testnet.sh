#!/bin/bash
# Update all MiniApp contracts on Neo TestNet
# This script updates existing contracts without redeploying
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
CONFIG_FILE="$PROJECT_ROOT/deploy/config/testnet_contracts.json"
WALLET_FILE="$PROJECT_ROOT/deploy/testnet/wallets/testnet.json"
WALLET_CONFIG="$PROJECT_ROOT/deploy/testnet/wallets/wallet-config.yaml"
RPC_ENDPOINT="https://testnet1.neo.coz.io:443"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Neo MiniApp Platform Contract Update (TestNet) ==="
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
    local build_name="${NAME_MAPPING[$name]:-$name}"
    local nef_file="$BUILD_DIR/${build_name}.nef"
    local manifest_file="$BUILD_DIR/${build_name}.manifest.json"

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

    echo -n "  Updating $name ($hash)... "

    # Execute update command (scripthash is positional argument)
    if neo-go contract update \
        --in "$nef_file" \
        --manifest "$manifest_file" \
        --wallet-config "$WALLET_CONFIG" \
        -r "$RPC_ENDPOINT" \
        --force \
        --await \
        "$hash" 2>&1; then
        echo -e "${GREEN}[OK]${NC}"
        ((UPDATED++))
        return 0
    else
        echo -e "${RED}[FAILED]${NC}"
        ((FAILED++))
        return 1
    fi
}

# Parse and update platform contracts
echo "=== Updating Platform Contracts ==="
for name in $(jq -r '.contracts | keys[]' "$CONFIG_FILE"); do
    hash=$(jq -r ".contracts[\"$name\"].address" "$CONFIG_FILE")
    if [ "$hash" != "null" ] && [ -n "$hash" ]; then
        update_contract "$name" "$hash" || true
    fi
done

echo ""
echo "=== Updating MiniApp Contracts ==="
for name in $(jq -r '.miniapp_contracts | keys[]' "$CONFIG_FILE"); do
    hash=$(jq -r ".miniapp_contracts[\"$name\"].address" "$CONFIG_FILE")
    if [ "$hash" != "null" ] && [ -n "$hash" ]; then
        update_contract "$name" "$hash" || true
    fi
done

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
