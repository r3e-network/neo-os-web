#!/bin/bash
find platform/host-app/ -type f -name "*.tsx" -exec sed -i '' 's/@\/components\/ui\/input/@\/components\/ui\/Input/g' {} +
