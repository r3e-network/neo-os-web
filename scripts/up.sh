#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/up.sh [--backend nitro] [--no-build] [--env-file PATH | --no-env-file]

Starts the Service Layer stack in Nitro mode.

Options:
  --backend MODE
               Only `nitro` is supported. Legacy `sgx`/`sim` values now fail.
  --no-build   Start the stack without rebuilding images.
  --env-file PATH
               Use a specific env file for Docker Compose.
  --no-env-file
               Ignore PROJECT_ROOT/.env.

Deprecated (ignored with warning):
  --insecure
  --signing-key PATH
  --signing-key-dir DIR
  --skip-signer-check

  -h, --help   Show this help.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKEND="nitro"
NO_BUILD="false"
ENV_FILE=""
NO_ENV_FILE="false"

used_deprecated="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --backend" >&2
        exit 2
      fi
      BACKEND="$(echo "$2" | tr 'A-Z' 'a-z')"
      shift 2
      ;;
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
    --insecure|--skip-signer-check)
      used_deprecated="true"
      shift
      ;;
    --signing-key|--signing-key-dir)
      used_deprecated="true"
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1" >&2
        exit 2
      fi
      shift 2
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

if [[ "$BACKEND" != "nitro" ]]; then
  echo "Unsupported --backend value: $BACKEND" >&2
  echo "This project is now Nitro-only. Use: ./scripts/up.sh --backend nitro" >&2
  exit 2
fi

if [[ "$used_deprecated" == "true" ]]; then
  echo "Warning: SGX/simulation flags are deprecated and ignored in Nitro-only mode." >&2
fi

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
