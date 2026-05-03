#!/bin/bash
set -e

cd "$(dirname "$0")"
mkdir -p build

echo "=== Building Platform Contracts ==="

find . -mindepth 3 -maxdepth 3 -name '*.csproj' ! -path './__tests__/*' | sort | while read -r project; do
  d="$(basename "$(dirname "$project")")"
  echo "Building $d..."
  dotnet build "$project" -c Release
  ~/.dotnet/tools/nccs "$project" --optimize=All --output ./build/
done

echo "=== Build Complete ==="
