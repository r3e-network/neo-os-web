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

write_function_configs() {
  # Supabase Edge runtime verifies JWTs by default before the function executes.
  # This platform supports:
  # - Bearer JWT (Supabase Auth) AND
  # - X-API-Key (user API keys) AND
  # - public endpoints (e.g. datafeed reads).
  #
  # Therefore we disable the runtime's pre-verification and let the functions
  # enforce auth themselves (see platform/edge/functions/_shared/supabase.ts).
  local fn
  for fn in "$DEST_DIR"/*; do
    if [[ -d "$fn" ]] && [[ -f "$fn/index.ts" ]]; then
      cat >"$fn/config.toml" <<'EOF'
verify_jwt = false
EOF
    fi
  done
}

write_function_configs

echo "Done."
