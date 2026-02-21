#!/bin/bash
# Migrate SVG assets from platform/host-app/public/miniapps/ to miniapps-uniapp/apps/*/src/static/

set -e

SOURCE_DIR="platform/host-app/public/miniapps"
TARGET_BASE="miniapps-uniapp/apps"

# Get list of apps in miniapps-uniapp
for app_dir in "$TARGET_BASE"/*/; do
    app_name=$(basename "$app_dir")

    # Skip if not a real app directory
    [[ ! -d "$app_dir/src" ]] && continue

    # Create static directory if not exists
    mkdir -p "$app_dir/src/static"

    # Check if source has assets for this app
    if [[ -d "$SOURCE_DIR/$app_name" ]]; then
        # Copy banner.svg if exists
        if [[ -f "$SOURCE_DIR/$app_name/banner.svg" ]]; then
            cp "$SOURCE_DIR/$app_name/banner.svg" "$app_dir/src/static/"
            echo "✓ Copied banner.svg for $app_name"
        fi

        # Copy icon.svg if exists
        if [[ -f "$SOURCE_DIR/$app_name/icon.svg" ]]; then
            cp "$SOURCE_DIR/$app_name/icon.svg" "$app_dir/src/static/"
            echo "✓ Copied icon.svg for $app_name"
        fi
    else
        echo "⚠ No source assets for $app_name"
    fi
done

echo ""
echo "Migration complete!"
