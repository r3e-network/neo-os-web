#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_ROOT="$ROOT_DIR/miniapps"
DEST_ROOT="$ROOT_DIR/platform/host-app/public/miniapp-assets"

mkdir -p "$DEST_ROOT"

synced=0

while IFS= read -r -d '' file; do
  rel="${file#"$SRC_ROOT"/}"
  app_slug="${rel%%/public/*}"
  filename="$(basename "$file")"

  mkdir -p "$DEST_ROOT/$app_slug"
  cp "$file" "$DEST_ROOT/$app_slug/$filename"
  synced=$((synced + 1))
done < <(
  find "$SRC_ROOT" -mindepth 3 -maxdepth 3 -type f -path "*/public/*" \
    \( -name "logo.png" -o -name "logo.jpg" -o -name "logo.jpeg" -o -name "logo.svg" \
       -o -name "banner.png" -o -name "banner.jpg" -o -name "banner.jpeg" -o -name "banner.svg" \) \
    -print0
)

echo "Synced $synced miniapp card asset files to $DEST_ROOT"
