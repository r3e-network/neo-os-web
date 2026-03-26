#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

run_direct=1
run_flagship=1

usage() {
  cat <<'EOF'
Usage: deploy/scripts/run_live_testnet_validation.sh [--direct-only|--flagship-only]

Runs live testnet validation layers for neo-miniapps-platform:
- cross-repo direct validation
- flagship miniapp live user flows
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --direct-only)
      run_direct=1
      run_flagship=0
      shift
      ;;
    --flagship-only)
      run_direct=0
      run_flagship=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

if [[ $run_direct -eq 1 ]]; then
  echo ""
  echo "=== Cross-Repo Direct Testnet Validation ==="
  bash "$SCRIPT_DIR/verify_cross_repo_testnet.sh"
fi

if [[ $run_flagship -eq 1 ]]; then
  echo ""
  echo "=== Flagship Miniapp Live User Flows ==="
  bash -lc "set -a; [ -f \"$REPO_ROOT/.env\" ] && . \"$REPO_ROOT/.env\"; set +a; node \"$SCRIPT_DIR/live_validate_flagship_user_flows.js\""
fi

echo ""
echo "Live testnet validation completed successfully."
