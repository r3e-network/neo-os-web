#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/docker_smoke.sh [--build] [--sgx] [--keep-running]

Runs an end-to-end smoke check for the local stack:
1) Starts stack via ./scripts/up.sh (simulation by default)
2) Verifies MarbleRun coordinator status
3) Verifies each service is running and listening on its local service port

Options:
  --build         Build images during startup (default: no build).
  --sgx           Run smoke checks against SGX compose mode (docker-compose.yaml).
  --keep-running  Do not tear down the stack on exit.
  -h, --help      Show this help.
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

BUILD="false"
KEEP_RUNNING="false"
MODE="simulation"
CHECK_RETRIES=20
CHECK_DELAY_SECONDS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      BUILD="true"
      shift
      ;;
    --sgx)
      MODE="sgx"
      shift
      ;;
    --keep-running)
      KEEP_RUNNING="true"
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

if [[ "$MODE" == "sgx" ]]; then
  COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yaml"
  COORDINATOR_STATUS_CMD=(marblerun status localhost:4433)
  UP_ARGS=()
else
  COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.simulation.yaml"
  COORDINATOR_STATUS_CMD=(marblerun status localhost:4433 --insecure)
  UP_ARGS=(--insecure)
fi

DOCKER_COMPOSE=(docker compose -f "$COMPOSE_FILE")
if [[ -f "$ENV_FILE" ]]; then
  DOCKER_COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
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
"${PROJECT_ROOT}/scripts/up.sh" "${UP_ARGS[@]}"

echo ""
echo "Checking MarbleRun coordinator..."
if "${COORDINATOR_STATUS_CMD[@]}" >/dev/null 2>&1; then
  echo "  [OK] ${COORDINATOR_STATUS_CMD[*]}"
else
  echo "  [FAIL] marblerun coordinator status check failed"
  exit 1
fi

declare -A SERVICES=(
  [neofeeds]=8083
  [neoflow]=8084
  [neoaccounts]=8085
  [neocompute]=8086
  [neovrf]=8087
  [neooracle]=8088
  [txproxy]=8090
  [neogasbank]=8091
  [globalsigner]=8092
  [neosimulation]=8093
  [neorequests]=8094
)

echo ""
echo "Checking service runtime status and local listener ports..."
failures=0
while IFS= read -r service; do
  port="${SERVICES[$service]}"

  if ! compose ps --status running "$service" | awk 'NR>1 {print}' | grep -q .; then
    echo "  [FAIL] ${service} is not running"
    failures=$((failures + 1))
    continue
  fi

  # Simulation marbles terminate TLS at the enclave host boundary, so direct
  # HTTP health checks from local or in-container shells can return 400/mtls
  # errors. A TCP connect on the local listener is a stable smoke probe.
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
done < <(printf "%s\n" "${!SERVICES[@]}" | sort)

echo ""
if [[ "$failures" -gt 0 ]]; then
  echo "Smoke check failed: ${failures} service check(s) failed."
  exit 1
fi

echo "Smoke check passed: all services are running and healthy."
