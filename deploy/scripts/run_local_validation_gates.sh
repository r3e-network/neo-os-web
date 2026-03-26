#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

run_host=1
run_admin=1

usage() {
  cat <<'EOF'
Usage: deploy/scripts/run_local_validation_gates.sh [--host-only|--admin-only]

Runs local validation gates for neo-miniapps-platform:
- host app test + build
- admin console test + build
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host-only)
      run_host=1
      run_admin=0
      shift
      ;;
    --admin-only)
      run_host=0
      run_admin=1
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

if [[ $run_host -eq 1 ]]; then
  echo ""
  echo "=== Host App Local Gates ==="
  npm run -s test:host-app
  npm --prefix platform/host-app run build
fi

if [[ $run_admin -eq 1 ]]; then
  echo ""
  echo "=== Admin Console Local Gates ==="
  npm run -s test:admin-console
  npm --prefix platform/admin-console run build
fi

echo ""
echo "Local validation gates completed successfully."
