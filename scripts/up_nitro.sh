#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/up_nitro.sh [--no-build] [--env-file PATH | --no-env-file]

Starts the local stack with Nitro-compatible service images by composing:
  - docker/docker-compose.simulation.yaml (shared service baseline)
  - docker/docker-compose.nitro.yaml

Options:
  --no-build      Start the stack without rebuilding images.
  --env-file PATH Use a specific env file for Docker Compose.
  --no-env-file   Ignore PROJECT_ROOT/.env.
  -h, --help      Show this help.
EOF
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

if [[ "$NO_ENV_FILE" == "true" && -n "$ENV_FILE" ]]; then
  echo "Cannot use --env-file and --no-env-file together" >&2
  exit 2
fi

DOCKER_COMPOSE=(docker compose -f "${PROJECT_ROOT}/docker/docker-compose.simulation.yaml" -f "${PROJECT_ROOT}/docker/docker-compose.nitro.yaml")

if [[ -n "$ENV_FILE" ]]; then
  if [[ "$ENV_FILE" != /* ]]; then
    ENV_FILE="${PROJECT_ROOT}/${ENV_FILE}"
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi
  DOCKER_COMPOSE=(docker compose --env-file "$ENV_FILE" -f "${PROJECT_ROOT}/docker/docker-compose.simulation.yaml" -f "${PROJECT_ROOT}/docker/docker-compose.nitro.yaml")
elif [[ "$NO_ENV_FILE" != "true" && -f "${PROJECT_ROOT}/.env" ]]; then
  DOCKER_COMPOSE=(docker compose --env-file "${PROJECT_ROOT}/.env" -f "${PROJECT_ROOT}/docker/docker-compose.simulation.yaml" -f "${PROJECT_ROOT}/docker/docker-compose.nitro.yaml")
fi

export TEE_BACKEND="${TEE_BACKEND:-nitro}"

echo "Starting Nitro stack with TEE_BACKEND=${TEE_BACKEND}"
echo "Compose files:"
echo "  - docker/docker-compose.simulation.yaml"
echo "  - docker/docker-compose.nitro.yaml"

up_args=(up -d)
if [[ "$NO_BUILD" == "true" ]]; then
  up_args+=(--no-build)
fi

"${DOCKER_COMPOSE[@]}" "${up_args[@]}"

echo "Nitro stack started."
