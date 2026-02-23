#!/bin/bash
sed -i '' 's/return raw/const mapped = raw/g' platform/host-app/lib/miniapp-definitions.ts
sed -i '' 's/} => item !== null);/} => item !== null);\n  return mapped as any;/g' platform/host-app/lib/miniapp-definitions.ts
