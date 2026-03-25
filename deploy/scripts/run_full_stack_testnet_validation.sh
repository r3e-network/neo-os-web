#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo ""
echo "=== Host App Local Gates ==="
npm run -s test:host-app
npm --prefix platform/host-app run build

echo ""
echo "=== Admin Console Local Gates ==="
npm run -s test:admin-console
npm --prefix platform/admin-console run build

echo ""
echo "=== Cross-Repo Direct Testnet Validation ==="
bash "$SCRIPT_DIR/verify_cross_repo_testnet.sh"

echo ""
echo "=== Flagship Miniapp Live User Flows ==="
bash -lc "set -a; [ -f \"$REPO_ROOT/.env\" ] && . \"$REPO_ROOT/.env\"; set +a; node \"$SCRIPT_DIR/live_validate_flagship_user_flows.js\""

echo ""
echo "Full-stack testnet validation completed successfully."
