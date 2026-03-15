#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/up.sh [--no-build] [--env-file PATH | --no-env-file]

Starts the Service Layer stack in Nitro mode.

Options:
  --no-build   Start the stack without rebuilding images.
  --env-file PATH
               Use a specific env file for Docker Compose.
  --no-env-file
               Ignore PROJECT_ROOT/.env.

  -h, --help   Show this help.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NO_BUILD="false"
ENV_FILE=""
NO_ENV_FILE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build)
      NO_BUILD="true"
      shift
      ;;
    --env-file)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --env-file" >&2
        exit 2
      fi
      ENV_FILE="$2"
      shift 2
      ;;
    --no-env-file)
      NO_ENV_FILE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

delegated_args=()
if [[ "$NO_BUILD" == "true" ]]; then
  delegated_args+=(--no-build)
fi
if [[ -n "$ENV_FILE" ]]; then
  delegated_args+=(--env-file "$ENV_FILE")
fi
if [[ "$NO_ENV_FILE" == "true" ]]; then
  delegated_args+=(--no-env-file)
fi

exec "${PROJECT_ROOT}/scripts/up_nitro.sh" "${delegated_args[@]}"
