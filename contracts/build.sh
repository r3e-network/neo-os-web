#!/bin/bash
# Build script for Neo N3 Smart Contracts

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

echo "Building Neo N3 Smart Contracts..."

# Ensure dotnet runtime can be resolved when tools are installed under ~/.dotnet.
if [ -z "${DOTNET_ROOT:-}" ] && [ -x "${HOME}/.dotnet/dotnet" ]; then
    export DOTNET_ROOT="${HOME}/.dotnet"
fi
if [ -n "${DOTNET_ROOT:-}" ]; then
    export PATH="${DOTNET_ROOT}:$PATH"
fi

# Resolve nccs (Neo Contract Compiler). Dotnet tools are commonly installed under ~/.dotnet/tools
# and that path may not be in $PATH in CI/containers.
NCCS_BIN="${NCCS_BIN:-}"
if [ -z "$NCCS_BIN" ]; then
    if command -v nccs &> /dev/null; then
        NCCS_BIN="nccs"
    elif [ -x "${HOME}/.dotnet/tools/nccs" ]; then
        NCCS_BIN="${HOME}/.dotnet/tools/nccs"
    else
        echo "Error: nccs (Neo Contract Compiler) not found"
        echo "Install with: dotnet tool install -g Neo.Compiler.CSharp"
        echo "Then ensure ~/.dotnet/tools is on PATH (or set NCCS_BIN)."
        exit 1
    fi
fi

# Create build directory
mkdir -p build
rm -rf build/*

failures=0

collect_artifacts() {
    local outdir=$1

    mapfile -t nef_files < <(find "$outdir" -maxdepth 1 -name "*.nef" -type f | sort)
    mapfile -t manifest_files < <(find "$outdir" -maxdepth 1 -name "*.manifest.json" -type f | sort)

    if [ "${#nef_files[@]}" -eq 0 ] || [ "${#manifest_files[@]}" -eq 0 ]; then
        return 1
    fi

    for nef_file in "${nef_files[@]}"; do
        local base
        base=$(basename "$nef_file" .nef)
        mv "$nef_file" "build/${base}.nef"
        echo "  ✓ ${base}.nef"
    done

    for manifest_file in "${manifest_files[@]}"; do
        local base
        base=$(basename "$manifest_file" .manifest.json)
        mv "$manifest_file" "build/${base}.manifest.json"
        echo "  ✓ ${base}.manifest.json"
    done

    return 0
}

build_sources() {
    local label=$1
    local outdir=$2
    shift 2

    local sources=("$@")
    if [ "${#sources[@]}" -eq 0 ]; then
        echo "  ⚠ No sources found for $label, skipping"
        return 0
    fi

    mkdir -p "$outdir"
    echo "Building $label..."

    if ! "$NCCS_BIN" "${sources[@]}" -o "$outdir"; then
        echo "  ✗ Compilation failed for $label"
        failures=$((failures + 1))
        rm -rf "$outdir"
        return 0
    fi

    if ! collect_artifacts "$outdir"; then
        echo "  ✗ Missing artifacts for $label"
        failures=$((failures + 1))
    fi

    rm -rf "$outdir"
    return 0
}

# MiniApp base files (shared partial classes)
# Core module - required by ALL MiniApps
MINIAPP_CORE_FILES=(
    "MiniAppBase/MiniAppBase.Core.cs"
)

# BetLimits module - only for Gaming MiniApps (~13%)
MINIAPP_BETLIMITS_FILES=(
    "MiniAppBase/MiniAppBase.BetLimits.cs"
)

# Gaming contracts that need BetLimits
GAMING_CONTRACTS=(
    "MiniAppCoinFlip"
    "MiniAppDiceGame"
    "MiniAppGasSpin"
    "MiniAppScratchCard"
    "MiniAppLottery"
    "MiniAppMicroPredict"
    "MiniAppPricePredict"
    "MiniAppTurboOptions"
    "MiniAppCandleWars"
)

is_gaming_contract() {
    local name=$1
    for gaming in "${GAMING_CONTRACTS[@]}"; do
        if [ "$gaming" = "$name" ]; then
            return 0
        fi
    done
    return 1
}

build_miniapp() {
    local label=$1
    local outdir=$2
    shift 2

    local sources=("$@")
    if [ "${#sources[@]}" -eq 0 ]; then
        echo "  ⚠ No sources found for $label, skipping"
        return 0
    fi

    # Add Core files (always)
    local all_sources=()
    for base_file in "${MINIAPP_CORE_FILES[@]}"; do
        if [ -f "$base_file" ]; then
            all_sources+=("$base_file")
        fi
    done

    # Add BetLimits only for Gaming contracts
    if is_gaming_contract "$label"; then
        for bet_file in "${MINIAPP_BETLIMITS_FILES[@]}"; do
            if [ -f "$bet_file" ]; then
                all_sources+=("$bet_file")
            fi
        done
        echo "Building $label (Core + BetLimits)..."
    else
        echo "Building $label (Core only)..."
    fi

    all_sources+=("${sources[@]}")

    mkdir -p "$outdir"

    if ! "$NCCS_BIN" "${all_sources[@]}" -o "$outdir"; then
        echo "  ✗ Compilation failed for $label"
        failures=$((failures + 1))
        rm -rf "$outdir"
        return 0
    fi

    if ! collect_artifacts "$outdir"; then
        echo "  ✗ Missing artifacts for $label"
        failures=$((failures + 1))
    fi

    rm -rf "$outdir"
    return 0
}

# Platform contracts (single-file)
# Format: "directory:ContractName"
platform_contracts=(
    "PaymentHub:PaymentHub"
    "Governance:Governance"
    "PriceFeed:PriceFeed"
    "RandomnessLog:RandomnessLog"
    "AppRegistry:AppRegistry"
    "AutomationAnchor:AutomationAnchor"
    "ServiceLayerGateway:ServiceLayerGateway"
    "PauseRegistry:PauseRegistry"
)

# Sample MiniApp contracts (optional)
sample_contracts=(
    "MiniAppServiceConsumer:MiniAppServiceConsumer"
)

# MiniApp contracts - Phase 1 (Gaming)
miniapp_contracts_phase1=(
    "MiniAppLottery:MiniAppLottery"
    "MiniAppCoinFlip:MiniAppCoinFlip"
    "MiniAppDiceGame:MiniAppDiceGame"
    "MiniAppScratchCard:MiniAppScratchCard"
    "MiniAppMegaMillions:MiniAppMegaMillions"
)

# MiniApp contracts - Phase 2 (DeFi/Social)
miniapp_contracts_phase2=(
    "MiniAppPredictionMarket:MiniAppPredictionMarket"
    "MiniAppFlashLoan:MiniAppFlashLoan"
    "MiniAppPriceTicker:MiniAppPriceTicker"
    "MiniAppGasSpin:MiniAppGasSpin"
    "MiniAppPricePredict:MiniAppPricePredict"
    "MiniAppSecretVote:MiniAppSecretVote"
    "MiniAppSecretPoker:MiniAppSecretPoker"
    "MiniAppMicroPredict:MiniAppMicroPredict"
    "MiniAppRedEnvelope:MiniAppRedEnvelope"
    "MiniAppGasCircle:MiniAppGasCircle"
    "MiniAppCanvas:MiniAppCanvas"
)

# MiniApp contracts - Phase 3 (Advanced)
miniapp_contracts_phase3=(
    "MiniAppFogChess:MiniAppFogChess"
    "MiniAppGovBooster:MiniAppGovBooster"
    "MiniAppTurboOptions:MiniAppTurboOptions"
    "MiniAppILGuard:MiniAppILGuard"
    "MiniAppGuardianPolicy:MiniAppGuardianPolicy"
)

# MiniApp contracts - Phase 4 (Long-Running)
miniapp_contracts_phase4=(
    "MiniAppAITrader:MiniAppAITrader"
    "MiniAppGridBot:MiniAppGridBot"
    "MiniAppNFTEvolve:MiniAppNFTEvolve"
    "MiniAppBridgeGuardian:MiniAppBridgeGuardian"
)

# MiniApp contracts - Phase 5 (New Gaming/DeFi/Social)
miniapp_contracts_phase5=(
    "MiniAppNeoCrash:MiniAppNeoCrash"
    "MiniAppCandleWars:MiniAppCandleWars"
    "MiniAppDutchAuction:MiniAppDutchAuction"
    "MiniAppParasite:MiniAppParasite"
    "MiniAppThroneOfGas:MiniAppThroneOfGas"
    "MiniAppNoLossLottery:MiniAppNoLossLottery"
    "MiniAppDoomsdayClock:MiniAppDoomsdayClock"
    "MiniAppPayToView:MiniAppPayToView"
)

# MiniApp contracts - Phase 6 (TEE-Powered Creative Apps)
miniapp_contracts_phase6=(
    "MiniAppSchrodingerNFT:MiniAppSchrodingerNFT"
    "MiniAppAlgoBattle:MiniAppAlgoBattle"
    "MiniAppTimeCapsule:MiniAppTimeCapsule"
    "MiniAppGardenOfNeo:MiniAppGardenOfNeo"
    "MiniAppDevTipping:MiniAppDevTipping"
)

# MiniApp contracts - Phase 7 (Advanced DeFi & Social)
miniapp_contracts_phase7=(
    "MiniAppAISoulmate:MiniAppAISoulmate"
    "MiniAppDeadSwitch:MiniAppDeadSwitch"
    "MiniAppHeritageTrust:MiniAppHeritageTrust"
    "MiniAppDarkRadio:MiniAppDarkRadio"
    "MiniAppZKBadge:MiniAppZKBadge"
    "MiniAppGraveyard:MiniAppGraveyard"
    "MiniAppCompoundCapsule:MiniAppCompoundCapsule"
    "MiniAppSelfLoan:MiniAppSelfLoan"
    "MiniAppDarkPool:MiniAppDarkPool"
    "MiniAppBurnLeague:MiniAppBurnLeague"
    "MiniAppGovMerc:MiniAppGovMerc"
)

# MiniApp contracts - Phase 8 (Creative & Social)
miniapp_contracts_phase8=(
    "MiniAppQuantumSwap:MiniAppQuantumSwap"
    "MiniAppOnChainTarot:MiniAppOnChainTarot"
    "MiniAppExFiles:MiniAppExFiles"
    "MiniAppScreamToEarn:MiniAppScreamToEarn"
    "MiniAppBreakupContract:MiniAppBreakupContract"
    "MiniAppGeoSpotlight:MiniAppGeoSpotlight"
    "MiniAppPuzzleMining:MiniAppPuzzleMining"
    "MiniAppNFTChimera:MiniAppNFTChimera"
    "MiniAppWorldPiano:MiniAppWorldPiano"
    "MiniAppBountyHunter:MiniAppBountyHunter"
    "MiniAppMasqueradeDAO:MiniAppMasqueradeDAO"
    "MiniAppMeltingAsset:MiniAppMeltingAsset"
    "MiniAppUnbreakableVault:MiniAppUnbreakableVault"
    "MiniAppWhisperChain:MiniAppWhisperChain"
    "MiniAppMillionPieceMap:MiniAppMillionPieceMap"
    "MiniAppFogPuzzle:MiniAppFogPuzzle"
    "MiniAppCryptoRiddle:MiniAppCryptoRiddle"
)

echo "=== Building Platform Contracts ==="
for entry in "${platform_contracts[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_sources "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building Sample MiniApp Contracts ==="
for entry in "${sample_contracts[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 1 (Gaming) ==="
for entry in "${miniapp_contracts_phase1[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 2 (DeFi/Social) ==="
for entry in "${miniapp_contracts_phase2[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 3 (Advanced) ==="
for entry in "${miniapp_contracts_phase3[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 4 (Long-Running) ==="
for entry in "${miniapp_contracts_phase4[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 5 (New Gaming/DeFi/Social) ==="
for entry in "${miniapp_contracts_phase5[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 6 (TEE-Powered Creative Apps) ==="
for entry in "${miniapp_contracts_phase6[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 7 (Advanced DeFi & Social) ==="
for entry in "${miniapp_contracts_phase7[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "=== Building MiniApp Contracts - Phase 8 (Creative & Social) ==="
for entry in "${miniapp_contracts_phase8[@]}"; do
    dir="${entry%%:*}"
    name="${entry##*:}"

    if [ -d "$dir" ]; then
        cs_files=$(find "$dir" -maxdepth 1 -name "*.cs" -type f | sort)
        # shellcheck disable=SC2086
        build_miniapp "$name" "build/${name}" $cs_files
    else
        echo "  ⚠ Directory $dir not found, skipping"
    fi
done

echo ""
echo "Build complete! Output in ./build/"
ls -la build/ 2>/dev/null || echo "No files in build directory"

if [ "$failures" -ne 0 ]; then
    echo ""
    echo "Build finished with ${failures} failure(s)."
    exit 1
fi
