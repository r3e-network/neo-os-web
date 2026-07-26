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

# shellcheck source=deploy/scripts/lib/neoexpress_config.sh
. "$SCRIPT_DIR/../lib/neoexpress_config.sh"
# shellcheck source=deploy/scripts/lib/build_artifacts.sh
. "$SCRIPT_DIR/../lib/build_artifacts.sh"
# shellcheck source=deploy/scripts/lib/dotnet_tools.sh
. "$SCRIPT_DIR/../lib/dotnet_tools.sh"

echo "=== MiniAppFactoryV2 Deployment ==="
echo "Network: $NETWORK"
echo "Project root: $PROJECT_ROOT"

ensure_dotnet_root

NCCS="$(resolve_dotnet_tool "nccs" "dotnet tool install -g Neo.Compiler.CSharp")"
NEOXP="$(resolve_dotnet_tool "neoxp" "dotnet tool install -g Neo.Express")"

# Build MiniAppFactoryV2
echo ""
echo "=== Building MiniAppFactoryV2 ==="
cd "$PROJECT_ROOT/contracts"

rm -rf build/temp_factory
mkdir -p build/temp_factory

# Glob expansion is already collation-ordered, so it needs no `sort`, and it
# keeps each source path in its own array element for the compiler invocation.
cs_files=()
for cs_file in MiniAppFactoryV2/*.cs; do
    if [ -f "$cs_file" ]; then
        cs_files+=("$cs_file")
    fi
done

if [ "${#cs_files[@]}" -eq 0 ]; then
    echo "No C# sources found in MiniAppFactoryV2" >&2
    rm -rf build/temp_factory
    exit 1
fi

if ! "$NCCS" "${cs_files[@]}" -o build/temp_factory; then
    echo "Compilation failed for MiniAppFactoryV2" >&2
    rm -rf build/temp_factory
    exit 1
fi

# Collect artifacts. nccs names its output after the project, so the pair is
# renamed here; the helper refuses to continue unless exactly one of each landed.
if ! promote_contract_artifacts "build/temp_factory" build "MiniAppFactoryV2"; then
    rm -rf build/temp_factory
    exit 1
fi
rm -rf build/temp_factory

# Deploy to network
echo ""
echo "=== Deploying MiniAppFactoryV2 ==="

if [ "$NETWORK" = "neoexpress" ]; then
    ensure_neoexpress_config "$NEOEXPRESS_CONFIG" "$NEOXP"
    
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
