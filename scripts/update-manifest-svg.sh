#!/bin/bash
# Update all MiniApp manifest.json to use local SVG files

APPS_DIR="/home/neo/git/service_layer/miniapps-uniapp/apps"

for app_dir in "$APPS_DIR"/*/; do
    manifest_file="$app_dir/src/manifest.json"
    app_name=$(basename "$app_dir")

    if [ -f "$manifest_file" ]; then
        # Update banner URL to local path
        sed -i 's|"banner": "https://[^"]*"|"banner": "/static/banner.svg"|g' "$manifest_file"

        # Update logo URL to local path
        sed -i 's|"logo": "https://[^"]*"|"logo": "/static/icon.svg"|g' "$manifest_file"

        echo "UPDATED: $app_name"
    else
        echo "MISSING: $app_name"
    fi
done

echo ""
echo "Done! All manifest.json files updated."
