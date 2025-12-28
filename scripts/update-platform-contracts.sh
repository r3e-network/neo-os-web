#!/bin/bash
# Update all platform contracts on testnet
# Usage: ./scripts/update-platform-contracts.sh

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$NEO_TESTNET_WIF" ]; then
    echo "Error: NEO_TESTNET_WIF not set"
    exit 1
fi

echo "=== Updating Platform Contracts on Testnet ==="
echo ""

# Contract mappings: hash -> nef name -> manifest name
declare -A CONTRACTS=(
    ["PaymentHub"]="0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193|PaymentHubV2"
    ["Governance"]="0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05|Governance"
    ["AppRegistry"]="0x79d16bee03122e992bb80c478ad4ed405f33bc7f|AppRegistry"
    ["ServiceLayerGateway"]="0x27b79cf631eff4b520dd9d95cd1425ec33025a53|ServiceLayerGateway"
)

BUILD_DIR="contracts/build"

for name in "${!CONTRACTS[@]}"; do
    IFS='|' read -r hash nef_name <<< "${CONTRACTS[$name]}"

    nef_path="${BUILD_DIR}/${nef_name}.nef"
    manifest_path="${BUILD_DIR}/${nef_name}.manifest.json"

    if [ ! -f "$nef_path" ] || [ ! -f "$manifest_path" ]; then
        echo "Warning: Build files not found for $name, skipping..."
        continue
    fi

    echo "----------------------------------------"
    echo "Updating $name..."
    echo "  Contract: $hash"
    echo "  NEF: $nef_path"
    echo "  Manifest: $manifest_path"
    echo ""

    go run ./cmd/update-contract/main.go \
        -contract "$hash" \
        -nef "$nef_path" \
        -manifest "$manifest_path"

    echo ""
    echo "$name updated successfully!"
    echo ""

    # Wait between updates to avoid rate limiting
    sleep 5
done

echo "=== All Platform Contracts Updated ==="
