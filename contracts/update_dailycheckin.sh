#!/bin/bash
# Update MiniAppDailyCheckin contract on Neo TestNet
# This script updates the existing contract without redeploying

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build_single"
CONTRACT_HASH="0x5a3f580fc14cd5f4d7746306eec7e2b44727ae2c"
NEF_FILE="$BUILD_DIR/MiniAppDailyCheckin.nef"
MANIFEST_FILE="$BUILD_DIR/MiniAppDailyCheckin.manifest.json"

echo "=== MiniAppDailyCheckin Contract Update ==="
echo "Contract Hash: $CONTRACT_HASH"
echo "NEF File: $NEF_FILE"
echo "Manifest: $MANIFEST_FILE"

# Check files exist
if [ ! -f "$NEF_FILE" ]; then
    echo "Error: NEF file not found at $NEF_FILE"
    echo "Run build first: ~/.dotnet/tools/nccs MiniAppBase/MiniAppBase.Core.cs MiniAppDailyCheckin/MiniAppDailyCheckin.cs -o build_single"
    exit 1
fi

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: Manifest file not found at $MANIFEST_FILE"
    exit 1
fi

echo ""
echo "Files ready for update:"
ls -la "$NEF_FILE" "$MANIFEST_FILE"

echo ""
echo "=== Update Instructions ==="
echo ""
echo "Option 1: Using neo-go CLI (recommended for TestNet):"
echo "  neo-go contract update \\"
echo "    -i $NEF_FILE \\"
echo "    -m $MANIFEST_FILE \\"
echo "    -w <your-wallet.json> \\"
echo "    --hash $CONTRACT_HASH \\"
echo "    -r https://testnet1.neo.coz.io:443"
echo ""
echo "Option 2: Using neoxp (for Neo Express local):"
echo "  neoxp contract update $NEF_FILE owner --hash $CONTRACT_HASH"
echo ""
echo "Option 3: Using SDK/API call:"
echo "  Call contract method: Update(ByteString nef, string manifest)"
echo "  - nef: base64 encoded content of $NEF_FILE"
echo "  - manifest: JSON string content of $MANIFEST_FILE"
echo ""
echo "=== NEF Base64 (for API calls) ==="
base64 -w 0 "$NEF_FILE"
echo ""
echo ""
echo "=== Contract Changes Summary ==="
echo "- Changed from per-user rolling 24h window to global UTC day"
echo "- lastCheckin now stores UTC day number (not timestamp)"
echo "- Streak resets if currentDay > lastDay + 1"
echo "- nextEligibleTs = (currentDay + 1) * 86400"
