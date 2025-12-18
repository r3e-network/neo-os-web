#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob extglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC_DIR="$PROJECT_ROOT/platform/edge/functions"
DEST_DIR="$PROJECT_ROOT/supabase/functions"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "ERROR: source functions directory not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

echo "Exporting Edge functions:"
echo "  from: $SRC_DIR"
echo "    to: $DEST_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude ".gitignore" \
    --exclude "README.md" \
    "$SRC_DIR/" "$DEST_DIR/"
else
  # Minimal fallback when rsync isn't available.
  # Remove previous exports (but keep the folder's README/.gitignore).
  find "$DEST_DIR" -mindepth 1 -maxdepth 1 \
    ! -name ".gitignore" \
    ! -name "README.md" \
    -exec rm -rf {} +

  cp -R "$SRC_DIR"/!(README.md|.gitignore) "$DEST_DIR"/

  # Match the rsync behavior for nested files as well.
  find "$DEST_DIR" -mindepth 2 \
    \( -name "README.md" -o -name ".gitignore" \) \
    -exec rm -f {} +
fi

echo "Done."
