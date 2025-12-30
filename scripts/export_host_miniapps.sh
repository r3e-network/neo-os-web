#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob extglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source: uni-app H5 builds
UNIAPP_DIR="$PROJECT_ROOT/miniapps-uniapp/apps"
DEST_DIR="$PROJECT_ROOT/platform/host-app/public/miniapps"

mkdir -p "$DEST_DIR"

echo "Exporting MiniApps H5 builds:"
echo "  from: $UNIAPP_DIR/*/dist/build/h5/"
echo "    to: $DEST_DIR"

# Export each uni-app H5 build
exported=0
for app_dir in "$UNIAPP_DIR"/*/; do
  app_name=$(basename "$app_dir")
  h5_path="$app_dir/dist/build/h5"

  if [[ -d "$h5_path" ]]; then
    target="$DEST_DIR/$app_name"
    mkdir -p "$target"
    cp -r "$h5_path"/* "$target/" 2>/dev/null || true
    exported=$((exported + 1))
  fi
done

echo "Exported $exported MiniApps"

# Copy shared bridge if it exists
BRIDGE_SRC="$PROJECT_ROOT/miniapps-uniapp/shared/miniapp-bridge.js"
BRIDGE_DEST="$PROJECT_ROOT/platform/host-app/public/sdk/miniapp-bridge.js"
if [[ -f "$BRIDGE_SRC" ]]; then
  mkdir -p "$(dirname "$BRIDGE_DEST")"
  cp "$BRIDGE_SRC" "$BRIDGE_DEST"
  echo "Copied miniapp-bridge.js"
fi

echo "Done."
