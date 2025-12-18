#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob extglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC_DIR="$PROJECT_ROOT/miniapps"
DEST_DIR="$PROJECT_ROOT/platform/host-app/public/miniapps"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "ERROR: source MiniApps directory not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

echo "Exporting MiniApps:"
echo "  from: $SRC_DIR"
echo "    to: $DEST_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude ".gitignore" \
    --exclude "README.md" \
    --exclude "templates/" \
    "$SRC_DIR/" "$DEST_DIR/"
else
  # Minimal fallback when rsync isn't available.
  # Remove previous exports (but keep the folder's README/.gitignore).
  find "$DEST_DIR" -mindepth 1 -maxdepth 1 \
    ! -name ".gitignore" \
    ! -name "README.md" \
    -exec rm -rf {} +

  cp -R "$SRC_DIR"/!(README.md|.gitignore|templates) "$DEST_DIR"/

  # Match the rsync behavior for nested files as well.
  find "$DEST_DIR" -mindepth 2 \
    \( -name "README.md" -o -name ".gitignore" \) \
    -exec rm -f {} +
fi

BRIDGE_SRC="$SRC_DIR/_shared/miniapp-bridge.js"
BRIDGE_DEST="$PROJECT_ROOT/platform/host-app/public/sdk/miniapp-bridge.js"
if [[ -f "$BRIDGE_SRC" ]]; then
  mkdir -p "$(dirname "$BRIDGE_DEST")"
  cp "$BRIDGE_SRC" "$BRIDGE_DEST"
fi

echo "Done."
