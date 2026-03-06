#!/bin/bash
set -e

cd "$(dirname "$0")"
mkdir -p build

echo "=== Building Platform Contracts ==="

for d in AppRegistry AutomationAnchor Governance PaymentHub PriceFeed RandomnessLog ServiceLayerGateway MiniAppCoinFlip MiniAppDiceGame MiniAppLottery MiniAppPredictionMarket OracleService MiniAppFactoryV2 MiniAppTemplates; do
  if [ -f "$d/$d.csproj" ]; then
    echo "Building $d..."
    dotnet build "$d/$d.csproj" -c Release
    ~/.dotnet/tools/nccs "$d/$d.csproj" --optimize=All --output ./build/
  fi
done

echo "=== Build Complete ==="
