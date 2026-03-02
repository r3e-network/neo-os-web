#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/docker_smoke.sh [--build] [--sgx|--nitro] [--signing-key PATH | --signing-key-dir DIR] [--keep-running]

Runs an end-to-end smoke check for the local stack:
1) Starts stack via ./scripts/up.sh (simulation/sgx) or ./scripts/up_nitro.sh (nitro)
2) Verifies MarbleRun coordinator status (simulation/sgx only)
3) Verifies each service is running and listening on its local service port

Options:
  --build         Build images during startup (default: no build).
  --sgx           Run smoke checks against SGX compose mode (docker-compose.yaml).
  --nitro         Run smoke checks against Nitro compose mode.
  --signing-key PATH
                  Forwarded to scripts/up.sh in SGX mode to build signed images.
  --signing-key-dir DIR
                  Forwarded to scripts/up.sh in SGX mode to build signed images.
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
SIGNING_KEY=""
SIGNING_KEY_DIR=""

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
    --nitro)
      MODE="nitro"
      shift
      ;;
    --signing-key)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --signing-key" >&2
        exit 2
      fi
      SIGNING_KEY="$2"
      shift 2
      ;;
    --signing-key-dir)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --signing-key-dir" >&2
        exit 2
      fi
      SIGNING_KEY_DIR="$2"
      shift 2
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
  COMPOSE_FILES=(-f "${PROJECT_ROOT}/docker/docker-compose.yaml")
  # Local compose deployments use coordinator-generated certs by default.
  COORDINATOR_STATUS_CMD=(marblerun status localhost:4433 --insecure)
  START_CMD=("${PROJECT_ROOT}/scripts/up.sh")
  UP_ARGS=()
  echo "SGX mode requires images signed with keys matching manifests/manifest.json."
elif [[ "$MODE" == "nitro" ]]; then
  COMPOSE_FILES=(-f "${PROJECT_ROOT}/docker/docker-compose.simulation.yaml" -f "${PROJECT_ROOT}/docker/docker-compose.nitro.yaml")
  COORDINATOR_STATUS_CMD=()
  START_CMD=("${PROJECT_ROOT}/scripts/up_nitro.sh")
  UP_ARGS=()
else
  COMPOSE_FILES=(-f "${PROJECT_ROOT}/docker/docker-compose.simulation.yaml")
  COORDINATOR_STATUS_CMD=(marblerun status localhost:4433 --insecure)
  START_CMD=("${PROJECT_ROOT}/scripts/up.sh")
  UP_ARGS=(--insecure)
fi

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
if [[ -n "$SIGNING_KEY" ]]; then
  UP_ARGS+=(--signing-key "$SIGNING_KEY")
fi
if [[ -n "$SIGNING_KEY_DIR" ]]; then
  UP_ARGS+=(--signing-key-dir "$SIGNING_KEY_DIR")
fi
if [[ "${#UP_ARGS[@]}" -gt 0 ]]; then
  "${START_CMD[@]}" "${UP_ARGS[@]}"
else
  "${START_CMD[@]}"
fi

if [[ "${#COORDINATOR_STATUS_CMD[@]}" -gt 0 ]]; then
  echo ""
  echo "Checking MarbleRun coordinator..."
  if "${COORDINATOR_STATUS_CMD[@]}" >/dev/null 2>&1; then
    echo "  [OK] ${COORDINATOR_STATUS_CMD[*]}"
  else
    echo "  [FAIL] marblerun coordinator status check failed"
    exit 1
  fi
else
  echo ""
  echo "Skipping MarbleRun coordinator check in Nitro mode."
fi

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
done

echo ""
if [[ "$failures" -gt 0 ]]; then
  if [[ "$MODE" == "sgx" ]]; then
    sgx_logs="$(compose logs --no-color --tail 500 2>/dev/null || true)"
    if printf "%s\n" "$sgx_logs" | grep -Eq "PackageProperties not compliant|marble verification failed"; then
      echo ""
      echo "Detected SGX signer mismatch: image SignerID does not match manifests/manifest.json."
    else
      echo ""
      echo "SGX smoke failed. A common cause is image SignerID mismatch against manifests/manifest.json."
    fi
    echo "Provide production signing keys and run one of:"
    echo "  ./scripts/docker_smoke.sh --sgx --build --signing-key /path/to/private.pem"
    echo "  ./scripts/docker_smoke.sh --sgx --build --signing-key-dir /path/to/keys"
  fi
  echo "Smoke check failed: ${failures} service check(s) failed."
  exit 1
fi

echo "Smoke check passed: all services are running and healthy."
