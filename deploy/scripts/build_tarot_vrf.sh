#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${DOTNET_ROOT:-}" && -d /opt/homebrew/opt/dotnet/libexec ]]; then
  export DOTNET_ROOT=/opt/homebrew/opt/dotnet/libexec
fi

NCCS="${NCCS:-$HOME/.dotnet/tools/nccs}"
if [[ ! -x "$NCCS" ]]; then
  echo "nccs not found at $NCCS; install Neo.Compiler.CSharp 3.9.1 first" >&2
  exit 1
fi

NCCS_VERSION="$("$NCCS" --version)"
if [[ "$NCCS_VERSION" != 3.9.1* ]]; then
  echo "MiniAppTarotVrf must be built with Neo.Compiler.CSharp 3.9.1; found $NCCS_VERSION" >&2
  exit 1
fi

dotnet build contracts/MiniAppTarotVrf/MiniAppTarotVrf.csproj -c Release
dotnet build contracts/TarotOracleMockFixture/TarotOracleMockFixture.csproj -c Release
"$NCCS" contracts/MiniAppTarotVrf/MiniAppTarotVrf.csproj \
  --checked --optimize=All --output contracts/build/
"$NCCS" contracts/TarotOracleMockFixture/TarotOracleMockFixture.csproj \
  --checked --optimize=All --output contracts/build/
node --test \
  deploy/scripts/lib/tarot_vrf_contract_artifact.test.mjs \
  deploy/scripts/lib/tarot_vrf_morpheus_abi.test.mjs
dotnet test contracts/__tests__/NeoContracts.Tests.csproj -c Release \
  --filter 'FullyQualifiedName~MiniAppTarotVrf'
