#!/bin/bash
# Update all MiniApp main.ts files to include Mock SDK

APPS_DIR="/home/neo/git/service_layer/miniapps-uniapp/apps"

for app_dir in "$APPS_DIR"/*/; do
    main_file="$app_dir/src/main.ts"
    app_name=$(basename "$app_dir")

    if [ -f "$main_file" ]; then
        # Check if already has installMockSDK
        if grep -q "installMockSDK" "$main_file"; then
            echo "SKIP: $app_name (already has Mock SDK)"
        else
            # Create new main.ts content
            cat > "$main_file" << 'EOF'
import { createSSRApp } from "vue";
import App from "./App.vue";
import { installMockSDK } from "@neo/uniapp-sdk";

// Install mock SDK for standalone development
if (import.meta.env.DEV) {
  installMockSDK();
}

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
EOF
            echo "UPDATED: $app_name"
        fi
    else
        echo "MISSING: $app_name (no main.ts)"
    fi
done

echo ""
echo "Done! All MiniApp main.ts files updated."
