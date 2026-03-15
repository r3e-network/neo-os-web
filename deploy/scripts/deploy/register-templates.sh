#!/bin/bash
# Register Templates to MiniAppFactoryV2
# Usage: ./register-templates.sh [neoexpress|testnet]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/contracts/build"
CONFIG_DIR="$PROJECT_ROOT/deploy/config"
DEPLOYED_FILE="$CONFIG_DIR/factory_deployed.json"

NETWORK=${1:-neoexpress}
NEOEXPRESS_CONFIG="$CONFIG_DIR/default.neo-express"

echo "=== Template Registration to MiniAppFactoryV2 ==="

# Ensure dotnet
if [ -z "${DOTNET_ROOT:-}" ] && [ -x "${HOME}/.dotnet/dotnet" ]; then
    export DOTNET_ROOT="${HOME}/.dotnet"
fi
if [ -n "${DOTNET_ROOT:-}" ]; then
    export PATH="${DOTNET_ROOT}:$PATH"
fi

resolve_tool() {
    local name=$1
    if command -v "$name" &> /dev/null; then echo "$name"; return 0; fi
    if [ -x "${HOME}/.dotnet/tools/$name" ]; then echo "${HOME}/.dotnet/tools/$name"; return 0; fi
    echo "Error: $name not found" >&2; exit 1
}

NEOXP=$(resolve_tool "neoxp")
NCCS=$(resolve_tool "nccs" "dotnet tool install -g Neo.Compiler.CSharp")

# Get factory address
if [ ! -f "$DEPLOYED_FILE" ]; then
    echo "Error: Factory not deployed. Run deploy-factory.sh first."
    exit 1
fi

FACTORY_HASH=$(jq -r '.MiniAppFactoryV2 // empty' "$DEPLOYED_FILE")
if [ -z "$FACTORY_HASH" ] || [ "$FACTORY_HASH" = "null" ]; then
    echo "Error: Factory address not found in $DEPLOYED_FILE"
    exit 1
fi

echo "Factory: $FACTORY_HASH"

# Build template contracts
echo ""
echo "=== Building Template Contracts ==="

TEMPLATES=(
    "MiniAppLottery:Lottery Game:gaming"
    "MiniAppCoinFlip:Coin Flip:gaming"
    "MiniAppDiceGame:Dice Game:gaming"
    "MiniAppScratchCard:Scratch Card:gaming"
    "MiniAppPredictionMarket:Prediction Market:defi"
    "MiniAppPriceTicker:Price Ticker:defi"
)

cd "$PROJECT_ROOT/contracts"

# Build each template
for entry in "${TEMPLATES[@]}"; do
    IFS=':' read -r name type category <<< "$entry"
    
    echo "Building $name..."
    mkdir -p build/temp_template
    
    # Include base files
    core_files="MiniAppBase/MiniAppBase.Core.cs"
    cs_files=$(find "$name" -maxdepth 1 -name "*.cs" -type f | sort)
    
    all_files="$core_files $cs_files"
    
    if "$NCCS" $all_files -o build/temp_template 2>/dev/null; then
        if [ -f build/temp_template/*.nef ]; then
            mv build/temp_template/*.nef "build/${name}.nef"
            mv build/temp_template/*.manifest.json "build/${name}.manifest.json"
            echo "  ✓ $name compiled"
        fi
    else
        echo "  ✗ $name compilation failed"
    fi
    rm -rf build/temp_template
done

# Register templates (via Neo Express contract invoke)
echo ""
echo "=== Registering Templates ==="

for entry in "${TEMPLATES[@]}"; do
    IFS=':' read -r name type category <<< "$entry"
    
    nef_file="build/${name}.nef"
    manifest_file="build/${name}.manifest.json"
    
    if [ ! -f "$nef_file" ] || [ ! -f "$manifest_file" ]; then
        echo "Skipping $name (not built)"
        continue
    fi
    
    echo "Registering $name..."
    
    if [ "$NETWORK" = "neoexpress" ]; then
        # Use neoxp contract invoke
        "$NEOXP" contract invoke "$FACTORY_HASH" \
            upsertTemplate \
            --string-arg "$name" \
            --string-arg "$type" \
            --string-arg "$category" \
            --byte-arg "$(cat "$nef_file" | base64 -w0)" \
            --string-arg "$(cat "$manifest_file")" \
            --string-arg "Template for $name" \
            --string-arg "1.0.0" \
            --string-arg "{}" \
            --string-arg "{}" \
            --boolean true \
            -i "$NEOEXPRESS_CONFIG" \
            -w owner 2>/dev/null || echo "  ⚠ May need manual registration"
        echo "  ✓ Registration attempted for $name"
    fi
done

echo ""
echo "=== Template Registration Complete ==="
echo "Templates: ${#TEMPLATES[@]}"
