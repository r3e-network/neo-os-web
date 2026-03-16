#!/bin/bash
# Deploy MiniAppFactoryV2 and Template Contracts
# Usage: ./deploy-factory.sh [neoexpress|testnet]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/contracts/build"
CONFIG_DIR="$PROJECT_ROOT/deploy/config"
DEPLOYED_FILE="$CONFIG_DIR/factory_deployed.json"

NETWORK=${1:-neoexpress}
NEOEXPRESS_CONFIG="$CONFIG_DIR/default.neo-express"

echo "=== MiniAppFactoryV2 Deployment ==="
echo "Network: $NETWORK"
echo "Project root: $PROJECT_ROOT"

# Ensure dotnet runtime
if [ -z "${DOTNET_ROOT:-}" ] && [ -x "${HOME}/.dotnet/dotnet" ]; then
    export DOTNET_ROOT="${HOME}/.dotnet"
fi
if [ -n "${DOTNET_ROOT:-}" ]; then
    export PATH="${DOTNET_ROOT}:$PATH"
fi

# Resolve tools
resolve_tool() {
    local name=$1
    local hint=$2
    if command -v "$name" &> /dev/null; then
        echo "$name"
        return 0
    fi
    if [ -x "${HOME}/.dotnet/tools/$name" ]; then
        echo "${HOME}/.dotnet/tools/$name"
        return 0
    fi
    echo "Error: $name not found. Install with: $hint" >&2
    exit 1
}

NCCS=$(resolve_tool "nccs" "dotnet tool install -g Neo.Compiler.CSharp")
NEOXP=$(resolve_tool "neoxp" "dotnet tool install -g Neo.Express")

# Build MiniAppFactoryV2
echo ""
echo "=== Building MiniAppFactoryV2 ==="
cd "$PROJECT_ROOT/contracts"

mkdir -p build/temp_factory
cs_files=$(find MiniAppFactoryV2 -maxdepth 1 -name "*.cs" -type f | sort)

if ! "$NCCS" $cs_files -o build/temp_factory; then
    echo "Compilation failed for MiniAppFactoryV2"
    rm -rf build/temp_factory
    exit 1
fi

# Collect artifacts
if [ -f build/temp_factory/*.nef ]; then
    mv build/temp_factory/*.nef build/MiniAppFactoryV2.nef
    mv build/temp_factory/*.manifest.json build/MiniAppFactoryV2.manifest.json
    echo "  ✓ MiniAppFactoryV2.nef"
    echo "  ✓ MiniAppFactoryV2.manifest.json"
fi
rm -rf build/temp_factory

# Deploy to network
echo ""
echo "=== Deploying MiniAppFactoryV2 ==="

if [ "$NETWORK" = "neoexpress" ]; then
    if [ ! -f "$NEOEXPRESS_CONFIG" ]; then
        echo "Creating Neo Express config..."
        "$NEOXP" create -o "$NEOEXPRESS_CONFIG" -f
    fi
    
    # Check if already deployed
    if [ -f "$DEPLOYED_FILE" ] && command -v jq &> /dev/null; then
        existing=$(jq -r '.MiniAppFactoryV2 // empty' "$DEPLOYED_FILE")
        if [ -n "$existing" ] && [ "$existing" != "null" ]; then
            echo "  Already deployed at: $existing"
            echo "  Updating contract..."
            "$NEOXP" contract update "$BUILD_DIR/MiniAppFactoryV2.nef" owner \
                -i "$NEOEXPRESS_CONFIG" --hash "$existing" 2>/dev/null || \
            "$NEOXP" contract update "$BUILD_DIR/MiniAppFactoryV2.nef" owner \
                "$existing" -i "$NEOEXPRESS_CONFIG" 2>/dev/null || true
            echo "  Update complete"
            exit 0
        fi
    fi
    
    # Deploy
    result=$("$NEOXP" contract deploy "$BUILD_DIR/MiniAppFactoryV2.nef" owner \
        -i "$NEOEXPRESS_CONFIG" 2>&1) || true
    
    hash=$(echo "$result" | grep -oP '0x[a-fA-F0-9]{40}' | head -1 || echo "")
    
    if [ -n "$hash" ]; then
        echo "  Deployed: $hash"
        
        # Save to config
        mkdir -p "$CONFIG_DIR"
        if [ -f "$DEPLOYED_FILE" ]; then
            jq --arg hash "$hash" '.MiniAppFactoryV2 = $hash' "$DEPLOYED_FILE" > "$DEPLOYED_FILE.tmp"
            mv "$DEPLOYED_FILE.tmp" "$DEPLOYED_FILE"
        else
            echo "{\"MiniAppFactoryV2\": \"$hash\"}" > "$DEPLOYED_FILE"
        fi
        echo "  Saved to: $DEPLOYED_FILE"
    else
        echo "  Warning: Could not extract hash"
        echo "  Output: $result"
    fi
    
elif [ "$NETWORK" = "testnet" ]; then
    echo "  TestNet deployment requires manual signing"
    echo "  Use: neo-go contract deploy"
    echo "    -i $BUILD_DIR/MiniAppFactoryV2.nef"
    echo "    -m $BUILD_DIR/MiniAppFactoryV2.manifest.json"
    echo "    --rpc-endpoint https://testnet1.neo.coz.io:443"
    echo "    --wallet <wallet-path> --account <account>"
fi

echo ""
echo "=== Deployment Complete ==="
echo "Next: Register templates with ./register-templates.sh"
