#!/bin/bash
# Deploy all Service Layer contracts to Neo Express or TestNet
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/contracts/build"
CONFIG_DIR="$PROJECT_ROOT/deploy/config"
DEPLOYED_FILE="$CONFIG_DIR/deployed_contracts.json"
WALLETS_DIR="$PROJECT_ROOT/deploy/wallets"

# Network selection
NETWORK=${1:-neoexpress}
NEOEXPRESS_CONFIG="$CONFIG_DIR/default.neo-express"

echo "=== Neo MiniApp Platform Contract Deployment ==="
echo "Network: $NETWORK"
echo "Build directory: $BUILD_DIR"

# Ensure dotnet runtime can be resolved when installed under ~/.dotnet.
if [ -z "${DOTNET_ROOT:-}" ] && [ -x "${HOME}/.dotnet/dotnet" ]; then
    export DOTNET_ROOT="${HOME}/.dotnet"
fi
if [ -n "${DOTNET_ROOT:-}" ]; then
    export PATH="${DOTNET_ROOT}:$PATH"
fi

# Resolve neoxp (dotnet-tool style installs may live in ~/.dotnet/tools and not be on PATH).
resolve_neoxp() {
    local resolved=""
    resolved="$(command -v neoxp 2>/dev/null || true)"
    if [ -n "$resolved" ]; then
        echo "$resolved"
        return 0
    fi
    local dotnet_tool="${HOME}/.dotnet/tools/neoxp"
    if [ -x "$dotnet_tool" ]; then
        echo "$dotnet_tool"
        return 0
    fi
    echo "Error: neoxp not found. Install with: dotnet tool install -g Neo.Express" >&2
    echo "Then ensure ~/.dotnet/tools is on PATH." >&2
    exit 1
}

NEOXP="$(resolve_neoxp)"

# Check if contracts are built
if [ ! -d "$BUILD_DIR" ] || [ -z "$(ls -A $BUILD_DIR/*.nef 2>/dev/null)" ]; then
    echo "Error: No built contracts found in $BUILD_DIR"
    echo "Run setup_neoexpress.sh first to build contracts"
    exit 1
fi

# Initialize deployed contracts file (preserve existing entries if present)
if [ -f "$DEPLOYED_FILE" ] && command -v jq >/dev/null 2>&1; then
    if ! jq -e . "$DEPLOYED_FILE" >/dev/null 2>&1; then
        echo "Warning: invalid $DEPLOYED_FILE, reinitializing"
        echo "{}" > "$DEPLOYED_FILE"
    fi
else
    echo "{}" > "$DEPLOYED_FILE"
fi

update_contract() {
    local name=$1
    local nef_path=$2
    local manifest_path=$3
    local hash=$4

    echo "  Updating $name at $hash..."

    if ! command -v "$NEOXP" >/dev/null 2>&1; then
        echo "  Error: neoxp not found; cannot update $name" >&2
        return 1
    fi

    # Try Neo Express contract update (preferred).
    local result
    if result=$("$NEOXP" contract update "$nef_path" owner -i "$NEOEXPRESS_CONFIG" --hash "$hash" 2>&1); then
        echo "  Updated via neoxp contract update"
        return 0
    fi

    # Fallback: some neoxp versions expect the hash as a positional argument.
    if result=$("$NEOXP" contract update "$nef_path" owner "$hash" -i "$NEOEXPRESS_CONFIG" 2>&1); then
        echo "  Updated via neoxp contract update (positional hash)"
        return 0
    fi

    echo "  Error: failed to update $name"
    echo "  Output: $result"
    echo "  Tip: update manually with neo-go CLI:"
    echo "    neo-go contract update -i $nef_path -m $manifest_path -w $WALLETS_DIR/owner.json --hash $hash"
    return 1
}

deploy_contract() {
    local name=$1
    local nef_path="$BUILD_DIR/${name}.nef"
    local manifest_path="$BUILD_DIR/${name}.manifest.json"
    local existing=""

    if [ ! -f "$nef_path" ]; then
        echo "  Skipping $name (not built)"
        return
    fi

    echo "Deploying $name..."

    if [ "$NETWORK" = "neoexpress" ]; then
        if command -v jq >/dev/null 2>&1 && [ -f "$DEPLOYED_FILE" ]; then
            existing=$(jq -r --arg name "$name" '.[$name] // empty' "$DEPLOYED_FILE")
        fi

        if [ -n "$existing" ]; then
            echo "  Already deployed at: $existing"
            if ! update_contract "$name" "$nef_path" "$manifest_path" "$existing"; then
                exit 1
            fi
            return
        fi

        # Deploy to Neo Express
        if ! result=$("$NEOXP" contract deploy "$nef_path" owner -i "$NEOEXPRESS_CONFIG" 2>&1); then
            if echo "$result" | grep -qi "already deployed"; then
                if [ -z "$existing" ]; then
                    echo "  Error: contract already deployed but no hash in $DEPLOYED_FILE"
                    echo "  Add the existing hash to $DEPLOYED_FILE and rerun to update."
                    exit 1
                fi
                if ! update_contract "$name" "$nef_path" "$manifest_path" "$existing"; then
                    exit 1
                fi
                return
            fi
            echo "  Error: failed to deploy $name"
            echo "  Output: $result"
            exit 1
        fi
        # Extract contract address from output
        hash=$(echo "$result" | grep -oP '0x[a-fA-F0-9]{40}' | head -1 || echo "")

        if [ -n "$hash" ]; then
            echo "  Deployed: $hash"
            # Update deployed contracts file
            jq --arg name "$name" --arg hash "$hash" '.[$name] = $hash' "$DEPLOYED_FILE" > "$DEPLOYED_FILE.tmp" && mv "$DEPLOYED_FILE.tmp" "$DEPLOYED_FILE"
        else
            echo "  Warning: Could not extract contract address"
            echo "  Output: $result"
        fi
    else
        echo "  TestNet deployment requires manual signing"
        echo "  Use: neo-go contract deploy -i $nef_path -m $manifest_path --rpc-endpoint <RPC_URL>"
    fi
}

# Deploy core contracts in order
echo ""
echo "=== Deploying Platform Contracts ==="
deploy_contract "PaymentHub"
deploy_contract "Governance"
deploy_contract "PriceFeed"
deploy_contract "RandomnessLog"
deploy_contract "AppRegistry"
deploy_contract "AutomationAnchor"
deploy_contract "ServiceLayerGateway"

echo ""
echo "=== Deployment Complete ==="
echo "Deployed contracts saved to: $DEPLOYED_FILE"
cat "$DEPLOYED_FILE"

echo ""
echo "Next step: Initialize contracts with:"
echo "  python3 deploy/scripts/initialize.py $NETWORK"
