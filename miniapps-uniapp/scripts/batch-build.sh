#!/bin/bash
# Batch build all uni-app MiniApps
# Continue on errors

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="$SCRIPT_DIR/../apps"
OUTPUT_DIR="$SCRIPT_DIR/../../platform/host-app/public/miniapps"

mkdir -p "$OUTPUT_DIR"

echo "=== Batch Build uni-app MiniApps ==="
echo "Apps dir: $APPS_DIR"
echo "Output dir: $OUTPUT_DIR"
echo ""

SUCCESS=0
FAILED=0
SKIPPED=0

for app_dir in "$APPS_DIR"/*/; do
  app_name=$(basename "$app_dir")

  if [ ! -f "$app_dir/package.json" ]; then
    echo "[$app_name] SKIP - no package.json"
    ((SKIPPED++))
    continue
  fi

  echo -n "[$app_name] Building... "
  cd "$app_dir"

  # Install deps if needed
  if [ ! -d "node_modules" ]; then
    npm install --silent 2>/dev/null || true
  fi

  # Build H5
  if npm run build --silent 2>/dev/null; then
    # Copy to output
    if [ -d "dist/build/h5" ]; then
      rm -rf "$OUTPUT_DIR/$app_name"
      cp -r "dist/build/h5" "$OUTPUT_DIR/$app_name"
      echo "OK"
      ((SUCCESS++))
    else
      echo "FAIL (no output)"
      ((FAILED++))
    fi
  else
    echo "FAIL (build error)"
    ((FAILED++))
  fi
done

echo ""
echo "=== Build Summary ==="
echo "Success: $SUCCESS"
echo "Failed: $FAILED"
echo "Skipped: $SKIPPED"
echo "Output: $OUTPUT_DIR"
