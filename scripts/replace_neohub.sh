#!/bin/bash
find platform/host-app/ -type f -name "*.tsx" -exec sed -i '' 's/NeoHub/R3E Network/g' {} +
find platform/host-app/ -type f -name "*.ts" -exec sed -i '' 's/NeoHub/R3E Network/g' {} +
find platform/host-app/ -type f -name "*.json" -exec sed -i '' 's/NeoHub/R3E Network/g' {} +
