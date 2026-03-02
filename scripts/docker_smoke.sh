#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/docker_smoke.sh [--build] [--nitro] [--keep-running]

Runs an end-to-end smoke check for the local Nitro stack:
1) Starts stack via ./scripts/up_nitro.sh
2) Verifies each service is running and listening on its local service port

Options:
  --build         Build images during startup (default: no build).
  --nitro         Explicitly select Nitro mode (default).
  --keep-running  Do not tear down the stack on exit.

Deprecated (unsupported):
  --sgx
  --signing-key PATH
  --signing-key-dir DIR

  -h, --help      Show this help.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

BUILD="false"
KEEP_RUNNING="false"
MODE="nitro"
CHECK_RETRIES=20
CHECK_DELAY_SECONDS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      BUILD="true"
      shift
      ;;
    --nitro)
      MODE="nitro"
      shift
      ;;
    --keep-running)
      KEEP_RUNNING="true"
      shift
      ;;
    --sgx)
      echo "--sgx is no longer supported. This project is Nitro-only." >&2
      exit 2
      ;;
    --signing-key|--signing-key-dir)
      echo "$1 is no longer supported in Nitro-only mode." >&2
      exit 2
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

COMPOSE_FILES=(-f "${PROJECT_ROOT}/docker/docker-compose.simulation.yaml" -f "${PROJECT_ROOT}/docker/docker-compose.nitro.yaml")
START_CMD=("${PROJECT_ROOT}/scripts/up_nitro.sh")
UP_ARGS=()

DOCKER_COMPOSE=(docker compose "${COMPOSE_FILES[@]}")
if [[ -f "$ENV_FILE" ]]; then
  DOCKER_COMPOSE=(docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}")
fi

compose() {
  "${DOCKER_COMPOSE[@]}" "$@"
}

cleanup() {
  if [[ "$KEEP_RUNNING" == "true" ]]; then
    return
  fi
  echo ""
  echo "Stopping stack..."
  compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting ${MODE} stack..."
if [[ "$BUILD" != "true" ]]; then
  UP_ARGS+=(--no-build)
fi

if [[ "${#UP_ARGS[@]}" -gt 0 ]]; then
  "${START_CMD[@]}" "${UP_ARGS[@]}"
else
  "${START_CMD[@]}"
fi

echo ""
echo "Skipping MarbleRun coordinator check in Nitro mode."

SERVICES=(
  "globalsigner:8092"
  "neoaccounts:8085"
  "neocompute:8086"
  "neofeeds:8083"
  "neoflow:8084"
  "neogasbank:8091"
  "neooracle:8088"
  "neorequests:8094"
  "neosimulation:8093"
  "neovrf:8087"
  "txproxy:8090"
)

echo ""
echo "Checking service runtime status and local listener ports..."
failures=0
for entry in "${SERVICES[@]}"; do
  service="${entry%%:*}"
  port="${entry##*:}"

  if ! compose ps --status running "$service" | awk 'NR>1 {print}' | grep -q .; then
    echo "  [FAIL] ${service} is not running"
    failures=$((failures + 1))
    continue
  fi

  connected="false"
  for attempt in $(seq 1 "$CHECK_RETRIES"); do
    if compose exec -T "$service" bash -lc "echo > /dev/tcp/127.0.0.1/${port}" </dev/null >/dev/null 2>&1; then
      connected="true"
      break
    fi
    sleep "$CHECK_DELAY_SECONDS"
  done

  if [[ "$connected" == "true" ]]; then
    echo "  [OK] ${service} tcp:${port}"
  else
    echo "  [FAIL] ${service} tcp:${port} listener check failed after ${CHECK_RETRIES}s"
    failures=$((failures + 1))
  fi
done

echo ""
if [[ "$failures" -gt 0 ]]; then
  echo "Smoke check failed: ${failures} service check(s) failed."
  exit 1
fi

echo "Smoke check passed: all services are running and healthy."
