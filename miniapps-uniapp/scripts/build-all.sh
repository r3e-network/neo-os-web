#!/bin/bash
# Build all uni-app MiniApps for H5
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="$SCRIPT_DIR/../apps"
OUTPUT_DIR="$SCRIPT_DIR/../../platform/host-app/public/miniapps"

mkdir -p "$OUTPUT_DIR"

echo "Building uni-app MiniApps..."

for app_dir in "$APPS_DIR"/*/; do
  app_name=$(basename "$app_dir")

  if [ ! -f "$app_dir/package.json" ]; then
    echo "  [SKIP] $app_name - no package.json"
    continue
  fi

  echo "  [BUILD] $app_name"

  cd "$app_dir"

  # Install deps if needed
  if [ ! -d "node_modules" ]; then
    pnpm install --silent 2>/dev/null || npm install --silent 2>/dev/null
  fi

  # Build H5
  pnpm build:h5 --silent 2>/dev/null || npm run build:h5 --silent 2>/dev/null

  # Copy to output
  if [ -d "dist/build/h5" ]; then
    rm -rf "$OUTPUT_DIR/$app_name"
    cp -r "dist/build/h5" "$OUTPUT_DIR/$app_name"
    echo "  [OK] $app_name -> $OUTPUT_DIR/$app_name"
  fi
done

echo "Done! Built apps are in $OUTPUT_DIR"
