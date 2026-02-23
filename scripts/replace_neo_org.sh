#!/bin/bash
find platform/host-app/public/miniapp-definitions/ -type f -name "*.json" -exec sed -i '' 's/neo.org/r3e.network/g' {} +
find platform/host-app/next.config.js -type f -exec sed -i '' 's/neo.org/r3e.network/g' {} +
find platform/edge/functions/compute-app-execute/index.ts -type f -exec sed -i '' 's/neo.org/r3e.network/g' {} +
