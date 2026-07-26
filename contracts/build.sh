#!/bin/bash
set -e

script_dir="$(cd "$(dirname "$0")" && pwd)"
source "$script_dir/../scripts/dotnet_env.sh"
cd "$script_dir"
mkdir -p build

legacy_clone_projects=(
  MiniAppAimMaster
  MiniAppColorClash
  MiniAppCurveArrow
  MiniAppFlappyDash
  MiniAppGame2048
  MiniAppJumpRush
  MiniAppMergeKingdom
  MiniAppPetPotion
  MiniAppSheepSolitaire
  MiniAppSnakeBounty
  MiniAppSudoku
)

include_legacy_clones=false
case "${BUILD_LEGACY_CLONES:-0}" in
  1|true|TRUE|yes|YES|on|ON) include_legacy_clones=true ;;
esac

is_legacy_clone_project() {
  local project_name="$1"
  for legacy_clone_project in "${legacy_clone_projects[@]}"; do
    if [[ "$project_name" == "$legacy_clone_project" ]]; then
      return 0
    fi
  done
  return 1
}

echo "=== Building Platform Contracts ==="
if [[ "$include_legacy_clones" == true ]]; then
  echo "Legacy game clones: included (BUILD_LEGACY_CLONES=${BUILD_LEGACY_CLONES})"
else
  echo "Legacy game clones: skipped (set BUILD_LEGACY_CLONES=1 for recovery/tests)"
fi

find . -mindepth 2 -maxdepth 3 -name '*.csproj' \
  ! -path './__tests__/*' \
  ! -path './PlatformDeFiLegacyCreditFixture/*' | sort | while read -r project; do
  d="$(basename "$(dirname "$project")")"
  if [[ "$include_legacy_clones" != true ]] && is_legacy_clone_project "$d"; then
    continue
  fi
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
