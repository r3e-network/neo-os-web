#!/bin/bash
set -e

cd "$(dirname "$0")"
mkdir -p build

echo "=== Building Platform Contracts ==="

find . -mindepth 2 -maxdepth 3 -name '*.csproj' \
  ! -path './__tests__/*' \
  ! -path './PlatformDeFiLegacyCreditFixture/*' | sort | while read -r project; do
  d="$(basename "$(dirname "$project")")"
  echo "Building $d..."
  dotnet build "$project" -c Release
  ~/.dotnet/tools/nccs "$project" --optimize=All --output ./build/
done

echo "Building PlatformDeFiLegacyCreditFixture..."
fixture_project="./PlatformDeFiLegacyCreditFixture/PlatformDeFiLegacyCreditFixture.csproj"
fixture_output="$(mktemp -d)"
trap 'rm -rf "$fixture_output"' EXIT
dotnet build "$fixture_project" -c Release
~/.dotnet/tools/nccs "$fixture_project" --optimize=All --output "$fixture_output/"
cp "$fixture_output/PlatformDeFi.nef" ./build/PlatformDeFiLegacyCreditFixture.nef
cp "$fixture_output/PlatformDeFi.manifest.json" \
  ./build/PlatformDeFiLegacyCreditFixture.manifest.json

echo "=== Build Complete ==="
