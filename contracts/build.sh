#!/bin/bash
set -e

cd "$(dirname "$0")"
mkdir -p build

echo "=== Building Platform Contracts ==="

# We compile the directories that actually have .csproj files.
# For MiniAppBase and templates, let's list them dynamically or explicitly.
for d in AppRegistry AutomationAnchor Governance MiniAppFactoryV2 PaymentHub PriceFeed RandomnessLog ServiceLayerGateway MiniAppTemplates MiniAppCoinFlip MiniAppDiceGame MiniAppLottery MiniAppPredictionMarket zNEP17; do
  if [ -f "$d/$d.csproj" ]; then
    echo "Building $d..."
    dotnet build "$d/$d.csproj" -c Release
    ~/.dotnet/tools/nccs "$d/$d.csproj" --optimize=All --output ./build/
  fi
done

echo "=== Build Complete ==="
