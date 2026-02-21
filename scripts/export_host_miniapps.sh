#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob extglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STRICT_EXPORT="${HOST_APP_STRICT_MINIAPP_EXPORT:-false}"

# Source: uni-app H5 builds
UNIAPP_DIR="$PROJECT_ROOT/miniapps-uniapp/apps"
DEST_DIR="$PROJECT_ROOT/platform/host-app/public/miniapps"

mkdir -p "$DEST_DIR"

echo "Exporting MiniApps H5 builds:"
echo "  from: $UNIAPP_DIR/*/dist/build/h5/"
echo "    to: $DEST_DIR"

# Export each uni-app H5 build
exported=0
missing_builds=0
for app_dir in "$UNIAPP_DIR"/*/; do
  app_name=$(basename "$app_dir")
  h5_path="$app_dir/dist/build/h5"
  target="$DEST_DIR/$app_name"

  if [[ -d "$h5_path" && -n "$(find "$h5_path" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    mkdir -p "$target"
    cp -r "$h5_path"/* "$target/" 2>/dev/null || true
    exported=$((exported + 1))
  else
    mkdir -p "$target"
    cat >"$target/index.html" <<EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${app_name} - Build Required</title>
    <style>
      body { margin: 0; font-family: sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; }
      main { max-width: 720px; padding: 24px; border: 1px solid #334155; border-radius: 12px; background: #111827; }
      code { background: #1f2937; padding: 2px 6px; border-radius: 6px; }
      h1 { margin-top: 0; font-size: 20px; }
      p { line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>MiniApp build is missing</h1>
      <p>This MiniApp (<code>${app_name}</code>) has no exported H5 build.</p>
      <p>Run the UniApp build pipeline and re-run <code>scripts/export_host_miniapps.sh</code>.</p>
    </main>
  </body>
</html>
EOF
    missing_builds=$((missing_builds + 1))
  fi
done

echo "Exported $exported MiniApps"
if [[ $missing_builds -gt 0 ]]; then
  echo "Generated $missing_builds fallback MiniApps (missing H5 build output)"
fi

if [[ "$STRICT_EXPORT" == "true" && $missing_builds -gt 0 ]]; then
  echo "ERROR: strict export mode is enabled and $missing_builds MiniApps are missing H5 builds."
  echo "Set HOST_APP_STRICT_MINIAPP_EXPORT=false to bypass (not recommended for production)."
  exit 1
fi

# Copy shared bridge if it exists
BRIDGE_SRC="$PROJECT_ROOT/miniapps-uniapp/shared/miniapp-bridge.js"
BRIDGE_DEST="$PROJECT_ROOT/platform/host-app/public/sdk/miniapp-bridge.js"
if [[ -f "$BRIDGE_SRC" ]]; then
  mkdir -p "$(dirname "$BRIDGE_DEST")"
  cp "$BRIDGE_SRC" "$BRIDGE_DEST"
  echo "Copied miniapp-bridge.js"
fi

echo "Done."
