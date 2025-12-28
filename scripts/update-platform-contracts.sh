#!/bin/bash
# Update all platform and MiniApp contracts on testnet
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

echo "=== Updating All Contracts on Testnet ==="
echo ""

BUILD_DIR="contracts/build"

# Platform contracts: name -> hash|nef_name
declare -A PLATFORM=(
    ["PaymentHub"]="0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193|PaymentHubV2"
    ["Governance"]="0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05|Governance"
    ["AppRegistry"]="0x79d16bee03122e992bb80c478ad4ed405f33bc7f|AppRegistry"
    ["AutomationAnchor"]="0x1c888d699ce76b0824028af310d90c3c18adeab5|AutomationAnchor"
    ["ServiceLayerGateway"]="0x27b79cf631eff4b520dd9d95cd1425ec33025a53|ServiceLayerGateway"
)

# MiniApp contracts: name -> hash|nef_name
declare -A MINIAPPS=(
    ["MiniAppLottery"]="0x3e330b4c396b40aa08d49912c0179319831b3a6e|MiniAppLottery"
    ["MiniAppCoinFlip"]="0xbd4c9203495048900e34cd9c4618c05994e86cc0|MiniAppCoinFlip"
    ["MiniAppDiceGame"]="0xfacff9abd201dca86e6a63acfb5d60da278da8ea|MiniAppDiceGame"
    ["MiniAppScratchCard"]="0x2674ef3b4d8c006201d1e7e473316592f6cde5f2|MiniAppScratchCard"
    ["MiniAppPredictionMarket"]="0x64118096bd004a2bcb010f4371aba45121eca790|MiniAppPredictionMarket"
    ["MiniAppFlashLoan"]="0xee51e5b399f7727267b7d296ff34ec6bb9283131|MiniAppFlashLoan"
    ["MiniAppPriceTicker"]="0x838bd5dd3d257a844fadddb5af2b9dac45e1d320|MiniAppPriceTicker"
    ["MiniAppGasSpin"]="0x19bcb0a50ddf5bf7cefbb47044cdb3ce4cb9e4cd|MiniAppGasSpin"
    ["MiniAppPricePredict"]="0x6317f97029b39f9211193085fe20dcf6500ec59d|MiniAppPricePredict"
    ["MiniAppSecretVote"]="0x7763ce957515f6acef6d093376977ac6c1cbc47d|MiniAppSecretVote"
    ["MiniAppSecretPoker"]="0xa27348cc0a79c776699a028244250b4f3d6bbe0c|MiniAppSecretPoker"
    ["MiniAppMicroPredict"]="0x73264e59d8215e28485420bb33ba841ff6fb45f8|MiniAppMicroPredict"
    ["MiniAppRedEnvelope"]="0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e|MiniAppRedEnvelope"
    ["MiniAppGasCircle"]="0x7736c8d1ff918f94d26adc688dac4d4bc084bd39|MiniAppGasCircle"
    ["MiniAppFogChess"]="0x23a44ca6643c104fbaa97daab65d5e53b3662b4a|MiniAppFogChess"
    ["MiniAppGovBooster"]="0xebabd9712f985afc0e5a4e24ed2fc4acb874796f|MiniAppGovBooster"
    ["MiniAppTurboOptions"]="0xbbe5a4d4272618b23b983c40e22d4b072e20f4bc|MiniAppTurboOptions"
    ["MiniAppILGuard"]="0xd3557ccbb2ced2254f5862fbc784cd97cf746872|MiniAppILGuard"
    ["MiniAppGuardianPolicy"]="0x893a774957244b83a0efed1d42771fe1e424cfec|MiniAppGuardianPolicy"
    ["MiniAppAITrader"]="0xc3356f394897e36b3903ea81d87717da8db98809|MiniAppAITrader"
    ["MiniAppGridBot"]="0x0d9cfc40ac2ab58de449950725af9637e0884b28|MiniAppGridBot"
    ["MiniAppNFTEvolve"]="0xadd18a719d14d59c064244833cd2c812c79d6015|MiniAppNFTEvolve"
    ["MiniAppBridgeGuardian"]="0x2d03f3e4ff10e14ea94081e0c21e79e79c33f9e3|MiniAppBridgeGuardian"
    ["MiniAppMegaMillions"]="0x5a8b9c2d3e4f5061728394a5b6c7d8e9f0a1b2c3|MiniAppMegaMillions"
)

update_contract() {
    local name=$1
    local hash=$2
    local nef_name=$3

    local nef_path="${BUILD_DIR}/${nef_name}.nef"
    local manifest_path="${BUILD_DIR}/${nef_name}.manifest.json"

    if [ ! -f "$nef_path" ] || [ ! -f "$manifest_path" ]; then
        echo "Warning: Build files not found for $name, skipping..."
        return 0
    fi

    echo "Updating $name ($hash)..."

    go run ./cmd/update-contract/main.go \
        -contract "$hash" \
        -nef "$nef_path" \
        -manifest "$manifest_path" 2>&1 || {
        echo "Warning: Failed to update $name, continuing..."
        return 0
    }

    echo "$name updated!"
    sleep 3
}

echo "=== Phase 1: Platform Contracts ==="
for name in "${!PLATFORM[@]}"; do
    IFS='|' read -r hash nef_name <<< "${PLATFORM[$name]}"
    update_contract "$name" "$hash" "$nef_name"
done

echo ""
echo "=== Phase 2: MiniApp Contracts ==="
for name in "${!MINIAPPS[@]}"; do
    IFS='|' read -r hash nef_name <<< "${MINIAPPS[$name]}"
    update_contract "$name" "$hash" "$nef_name"
done

echo ""
echo "=== All Contracts Updated ==="
