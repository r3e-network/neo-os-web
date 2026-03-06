#!/bin/bash
# Setup Neo Express environment for Service Layer development
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$PROJECT_ROOT/deploy"
WALLETS_DIR="$DEPLOY_DIR/wallets"
CONFIG_DIR="$DEPLOY_DIR/config"

echo "=== Service Layer Neo Express Setup ==="
echo "Project root: $PROJECT_ROOT"

# Ensure dotnet runtime can be resolved when installed under ~/.dotnet (common in CI/containers).
if [ -z "${DOTNET_ROOT:-}" ] && [ -x "${HOME}/.dotnet/dotnet" ]; then
    export DOTNET_ROOT="${HOME}/.dotnet"
fi
if [ -n "${DOTNET_ROOT:-}" ]; then
    export PATH="${DOTNET_ROOT}:$PATH"
fi

# Resolve dotnet-tool style binaries. In CI/containers ~/.dotnet/tools may not be on PATH.
resolve_tool() {
    local name="$1"
    local install_hint="$2"

    local resolved=""
    resolved="$(command -v "$name" 2>/dev/null || true)"
    if [ -n "$resolved" ]; then
        echo "$resolved"
        return 0
    fi

    local dotnet_tool="${HOME}/.dotnet/tools/${name}"
    if [ -x "$dotnet_tool" ]; then
        echo "$dotnet_tool"
        return 0
    fi

    echo "Error: ${name} is not installed" >&2
    echo "Install with: ${install_hint}" >&2
    echo "Then ensure ~/.dotnet/tools is on PATH." >&2
    exit 1
}

NEOXP="$(resolve_tool "neoxp" "dotnet tool install -g Neo.Express")"
NCCS="$(resolve_tool "nccs" "dotnet tool install -g Neo.Compiler.CSharp")"

mkdir -p "$WALLETS_DIR" "$CONFIG_DIR"

NEOEXPRESS_CONFIG="$CONFIG_DIR/default.neo-express"
if [ ! -f "$NEOEXPRESS_CONFIG" ]; then
    echo "Initializing Neo Express configuration..."
    "$NEOXP" create -o "$NEOEXPRESS_CONFIG" -f
fi

create_wallet() {
    local name=$1

    echo "Ensuring $name wallet..."
    if out=$("$NEOXP" wallet create "$name" -i "$NEOEXPRESS_CONFIG" 2>&1); then
        echo "Created wallet $name"
        return 0
    fi

    if echo "$out" | grep -qi "already exists"; then
        echo "Wallet $name already exists"
        return 0
    fi

    echo "Failed to create wallet $name:" >&2
    echo "$out" >&2
    exit 1
}

get_balance() {
    local wallet="$1"
    local asset="$2"

    "$NEOXP" show balances -i "$NEOEXPRESS_CONFIG" "$wallet" 2>/dev/null | awk -v asset="$asset" '
        $1 == asset { in_asset = 1; next }
        in_asset && $1 == "balance:" { print $2; exit }
    '
}

balance_at_least() {
    local current="$1"
    local minimum="$2"
    awk -v current="$current" -v minimum="$minimum" 'BEGIN { exit !((current + 0) >= (minimum + 0)) }'
}

ensure_balance() {
    local wallet="$1"
    local asset="$2"
    local minimum="$3"
    local quantity="$4"

    local current="$(get_balance "$wallet" "$asset")"
    if [ -n "$current" ] && balance_at_least "$current" "$minimum"; then
        echo "$wallet already has ${current} ${asset}"
        return 0
    fi

    echo "Funding $wallet with $quantity $asset from genesis..."
    local out=""
    if ! out=$("$NEOXP" transfer "$quantity" "$asset" genesis "$wallet" -i "$NEOEXPRESS_CONFIG" 2>&1); then
        echo "Failed to fund $wallet with $quantity $asset from genesis:" >&2
        echo "$out" >&2
        return 1
    fi

    current="$(get_balance "$wallet" "$asset")"
    if [ -n "$current" ] && balance_at_least "$current" "$minimum"; then
        echo "$wallet funded successfully (${current} ${asset})"
        return 0
    fi

    echo "Funding transaction for $wallet completed, but ${asset} balance is still below ${minimum}." >&2
    return 1
}

create_wallet "owner"
create_wallet "tee"
create_wallet "user"

echo "Funding wallets from genesis..."
funding_failed=0
ensure_balance "owner" "GAS" 1000 1000 || funding_failed=1
ensure_balance "owner" "NEO" 100 100 || funding_failed=1
ensure_balance "tee" "GAS" 500 500 || funding_failed=1
ensure_balance "user" "GAS" 100 100 || funding_failed=1

if [ "$funding_failed" -ne 0 ]; then
    echo >&2
    echo "Neo Express wallet funding did not complete successfully." >&2
    echo "This environment's neoxp build appears unable to spend fresh genesis funds reliably." >&2
    echo "Contract deployment tests that depend on Neo Express will keep failing until funding is fixed." >&2
    exit 1
fi

echo ""
echo "Building contracts..."
cd "$PROJECT_ROOT/contracts"
NCCS_BIN="$NCCS" ./build.sh

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Neo Express config: $NEOEXPRESS_CONFIG"
echo "Wallets directory: $WALLETS_DIR"
echo "Contract builds: $PROJECT_ROOT/contracts/build/"
echo ""
echo "Next steps:"
echo "  1. Start Neo Express: neoxp run -i $NEOEXPRESS_CONFIG"
echo "  2. Deploy contracts: ./deploy/scripts/deploy_all.sh"
echo "  3. Initialize contracts: python3 deploy/scripts/initialize.py"
