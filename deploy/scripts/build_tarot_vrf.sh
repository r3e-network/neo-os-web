#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

# shellcheck source=deploy/scripts/lib/dotnet_tools.sh
. "$SCRIPT_DIR/lib/dotnet_tools.sh"
ensure_dotnet_root

# NCCS still overrides discovery, so a locally built 3.9.1 compiler can be used.
NCCS="$(resolve_dotnet_tool nccs "dotnet tool install -g Neo.Compiler.CSharp --version 3.9.1")"

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
