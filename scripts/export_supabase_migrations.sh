#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC_DIR="$PROJECT_ROOT/migrations"
DEST_DIR="$PROJECT_ROOT/supabase/migrations"
K8S_DEST_DIR="$PROJECT_ROOT/k8s/supabase/overlays/local/migrations"
BASE_VERSION="${SUPABASE_MIGRATIONS_BASE_VERSION:-20000101000000}"
INDEXER_SRC_DIR="$SRC_DIR/indexer"
INDEXER_BASE_VERSION="${SUPABASE_INDEXER_MIGRATIONS_BASE_VERSION:-20000101000100}"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "ERROR: source migrations directory not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR" "$K8S_DEST_DIR"

echo "Exporting migrations:"
echo "  from: $SRC_DIR"
echo "    to: $DEST_DIR"
echo "    to: $K8S_DEST_DIR"

if [[ ! "$BASE_VERSION" =~ ^[0-9]{14}$ ]]; then
  echo "ERROR: SUPABASE_MIGRATIONS_BASE_VERSION must be 14 digits (got: $BASE_VERSION)" >&2
  exit 1
fi

# Supabase CLI expects migration filenames to start with a 14-digit version, e.g.
# `20241218093000_init.sql`. The canonical source migrations in this repo use
# `NNN_name.sql` for readability. We export into a Supabase-compatible layout
# by mapping:
#   001_initial_schema.sql -> 20000101000001_initial_schema.sql
#   024_rate_limit_bump.sql -> 20000101000024_rate_limit_bump.sql
#
# The mapping is deterministic based on the numeric prefix.

# Keep tracked layout in dest, but remove previously-exported SQL files.
find "$DEST_DIR" -maxdepth 1 -type f -name "*.sql" -delete
find "$K8S_DEST_DIR" -maxdepth 1 -type f -name "*.sql" -delete

copy_migration_set() {
  local source_dir="$1"
  local base_version="$2"
  local copied_ref_name="$3"

  if [[ ! -d "$source_dir" ]]; then
    return 0
  fi

  local copied_local=0
  local src base prefix rest n version dest k8s_dest
  for src in "$source_dir"/[0-9][0-9][0-9]_*.sql; do
    [[ -e "$src" ]] || continue
    base="$(basename "$src")"
    prefix="${base%%_*}"
    rest="${base#*_}"

    if [[ ! "$prefix" =~ ^[0-9]{3}$ ]]; then
      echo "WARN: skipping migration with unexpected name: $base" >&2
      continue
    fi

    n="$((10#$prefix))"
    version="$((10#$base_version + n))"
    version="$(printf "%014d" "$version")"

    dest="$DEST_DIR/${version}_${rest}"
    k8s_dest="$K8S_DEST_DIR/${version}_${rest}"
    cp -f "$src" "$dest"
    cp -f "$src" "$k8s_dest"
    chmod 0644 "$dest" "$k8s_dest" || true
    copied_local=$((copied_local + 1))
  done

  printf -v "$copied_ref_name" '%s' "$copied_local"
}

copied=0
main_copied=0
indexer_copied=0
shopt -s nullglob
copy_migration_set "$SRC_DIR" "$BASE_VERSION" main_copied
copy_migration_set "$INDEXER_SRC_DIR" "$INDEXER_BASE_VERSION" indexer_copied
copied=$((main_copied + indexer_copied))

if [[ $main_copied -eq 0 ]]; then
  echo "WARN: no main migrations were exported (expected files like 001_name.sql)" >&2
fi
if [[ -d "$INDEXER_SRC_DIR" && $indexer_copied -eq 0 ]]; then
  echo "WARN: no indexer migrations were exported (expected files like indexer/001_name.sql)" >&2
fi

echo "Done."
