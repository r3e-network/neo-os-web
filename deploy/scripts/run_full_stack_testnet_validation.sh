#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

run_local=1
run_live=1
live_args=()

usage() {
  cat <<'EOF'
Usage: deploy/scripts/run_full_stack_testnet_validation.sh [--skip-local|--skip-live|--direct-only|--flagship-only]

Composition:
- local validation gates
- live testnet validation
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-local)
      run_local=0
      shift
      ;;
    --skip-live)
      run_live=0
      shift
      ;;
    --direct-only|--flagship-only)
      live_args+=("$1")
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

if [[ $run_local -eq 1 ]]; then
  bash "$SCRIPT_DIR/run_local_validation_gates.sh"
fi

if [[ $run_live -eq 1 ]]; then
  bash "$SCRIPT_DIR/run_live_testnet_validation.sh" "${live_args[@]}"
fi

echo ""
echo "Full-stack testnet validation completed successfully."
