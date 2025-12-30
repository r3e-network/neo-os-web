#!/bin/bash
# Fix all MiniApp package.json files to add dev:h5 script

APPS_DIR="/home/neo/git/service_layer/miniapps-uniapp/apps"

for app_dir in "$APPS_DIR"/*/; do
    pkg_file="$app_dir/package.json"
    if [ -f "$pkg_file" ]; then
        app_name=$(basename "$app_dir")

        # Check if dev:h5 already exists
        if grep -q '"dev:h5"' "$pkg_file"; then
            echo "SKIP: $app_name (dev:h5 already exists)"
        else
            # Add dev:h5 script after "dev": "uni"
            sed -i 's/"dev": "uni",/"dev": "uni",\n    "dev:h5": "uni -p h5",/' "$pkg_file"
            echo "FIXED: $app_name"
        fi
    fi
done

echo ""
echo "Done! All MiniApp package.json files have been updated."
