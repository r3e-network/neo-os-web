#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
SRC_DIR="$ROOT_DIR/miniapps"
OUT_DIR="$ROOT_DIR/platform/host-app/public/miniapp-definitions"
FORCE="${1:-}"

if [ ! -d "$SRC_DIR" ]; then
  echo "miniapps directory not found: $SRC_DIR"
  exit 1
fi

mkdir -p "$OUT_DIR"

title_case() {
  local input="$1"
  echo "$input" | tr '-' ' ' | awk '{ for (i = 1; i <= NF; i++) { $i = toupper(substr($i,1,1)) tolower(substr($i,2)); } print }'
}

find_asset() {
  local app_dir="$1"
  local stem="$2"
  for ext in jpg jpeg png svg; do
    if [ -f "$app_dir/public/$stem.$ext" ]; then
      echo "/miniapp-assets/$(basename "$app_dir")/$stem.$ext"
      return 0
    fi
  done
  echo ""
}

count=0
for app_dir in "$SRC_DIR"/*; do
  [ -d "$app_dir" ] || continue
  [ -d "$app_dir/public" ] || continue
  case "$(basename "$app_dir")" in
    templates|shared|_shared)
      continue
      ;;
  esac

  slug="$(basename "$app_dir")"
  app_id="miniapp-$slug"
  name="$(title_case "$slug")"
  entry_url="mf://manifest?app=$app_id"
  output="$OUT_DIR/$slug.json"

  if [ -f "$output" ] && [ "$FORCE" != "--force" ]; then
    continue
  fi

  logo_url="$(find_asset "$app_dir" "logo")"
  banner_url="$(find_asset "$app_dir" "banner")"

  cat >"$output" <<JSON
{
  "\$schema": "./miniapp-config.schema.json",
  "app_id": "$app_id",
  "name": "$name",
  "template_type": "utility",
  "entry_url": "$entry_url",
  "media": {
    "icon": "$logo_url",
    "banner": "$banner_url"
  },
  "contract": {
    "template_id": "utility-generic"
  },
  "content": {
    "logo_url": "$logo_url",
    "banner_url": "$banner_url",
    "category": "utility"
  },
  "frontend_spec": {
    "format": "markdown",
    "content": "# $name\\n\\nDescribe app rules, settlement conditions, and risk notes here."
  },
  "operations": []
}
JSON

  count=$((count + 1))
done

echo "Scaffolded $count miniapp definition file(s) into: $OUT_DIR"
