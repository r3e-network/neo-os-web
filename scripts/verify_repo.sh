#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm audit --omit=dev --audit-level=high
npm audit --workspace platform/host-app --omit=dev --audit-level=high
npm run test:deploy-scripts
npm --prefix platform/admin-console test --silent
npm --prefix platform/admin-console run typecheck
npm --prefix platform/admin-console run build
npm --prefix platform/host-app run test:full
