#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/up.sh [--insecure] [--no-build] [--env-file PATH | --no-env-file] [--signing-key PATH | --signing-key-dir DIR] [--skip-signer-check]

Starts the Service Layer stack via Docker Compose and (re)configures MarbleRun.

Options:
  --insecure   Run in SGX simulation mode (OE_SIMULATION=1) and skip quote verification.
  --no-build   Start the stack without building images (recommended for SGX hardware/prod).
  --env-file PATH
               Use a specific env file for Docker Compose (overrides PROJECT_ROOT/.env).
  --no-env-file
               Ignore PROJECT_ROOT/.env (use only the current process environment).
  --signing-key PATH
               Build SGX images locally using a single enclave signing key (BuildKit secret).
  --signing-key-dir DIR
               Build SGX images locally using per-package keys named <package>.pem
               (or <package>-private.pem) for neofeeds/.../globalsigner
  --skip-signer-check
               Skip comparing key-derived SignerIDs against manifests/manifest.json (not recommended).
Environment:
  MARBLERUN_STRICT_TLS=1
               In SGX mode, require strict TLS verification for marblerun CLI calls.
               Default behavior for localhost coordinator is to use --insecure.
  AUTO_FUND_TXPROXY_SIGNER=1|0
               Auto-top-up txproxy signer balance after startup.
               Defaults to 1 in --insecure mode, 0 otherwise.
  TXPROXY_SIGNER_MIN_GAS
               Minimum signer GAS balance target (default: 30).
  TXPROXY_SIGNER_TOPUP_GAS
               Top-up transfer amount when below minimum (default: 100).
  AUTO_FUND_TXPROXY_SIGNER_REQUIRED=1
               Fail startup if signer funding step fails.
  EGO_PRIVATE_KEY_FILE
               Default SGX enclave signing key path (used when --signing-key is not provided).
  -h, --help   Show this help.
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

INSECURE="false"
NO_BUILD="false"
ENV_FILE=""
NO_ENV_FILE="false"
SIGNING_KEY=""
SIGNING_KEY_DIR=""
SKIP_SIGNER_CHECK="false"

cleanup_files=()
cleanup() {
  local file
  for file in "${cleanup_files[@]}"; do
    rm -f "$file" || true
  done
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --insecure)
      INSECURE="true"
      shift
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
    --skip-signer-check)
      SKIP_SIGNER_CHECK="true"
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

# Address used by marbles (containers) to reach the coordinator mesh port.
# Default uses Docker Compose service DNS (bridge network), not host networking.
COORDINATOR_MESH_ADDR="${COORDINATOR_MESH_ADDR:-coordinator:2001}"
COORDINATOR_CLIENT_ADDR="${COORDINATOR_CLIENT_ADDR:-localhost:4433}"
export COORDINATOR_MESH_ADDR COORDINATOR_CLIENT_ADDR

if [[ "$INSECURE" == "true" ]]; then
  export OE_SIMULATION=1
  COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.simulation.yaml"
  MANIFEST_SRC="${PROJECT_ROOT}/manifests/manifest.json"
  MANIFEST_FILE="$(mktemp -t service-layer-manifest.simulation.XXXXXX.json)"
  MARBLERUN_FLAGS=(--insecure)
else
  export OE_SIMULATION=0
  COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yaml"
  MANIFEST_FILE="${PROJECT_ROOT}/manifests/manifest.json"
  MARBLERUN_FLAGS=()

  # Local SGX compose deployments use coordinator-generated certs. Unless
  # explicitly overridden, use --insecure for local marblerun CLI operations so
  # status/manifest checks do not fail on self-signed cert verification.
  if [[ "${MARBLERUN_STRICT_TLS:-0}" != "1" ]] && [[ "$COORDINATOR_CLIENT_ADDR" =~ ^(localhost|127\.0\.0\.1|\[::1\]): ]]; then
    MARBLERUN_FLAGS=(--insecure)
  fi
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ "$INSECURE" == "true" ]]; then
  if [[ ! -f "$MANIFEST_SRC" ]]; then
    echo "Manifest file not found: $MANIFEST_SRC" >&2
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq not found in PATH (required to build simulation manifest)" >&2
    exit 1
  fi
  cleanup_files+=("$MANIFEST_FILE")

  jq --arg signerid "0000000000000000000000000000000000000000000000000000000000000000" \
    '.Packages |= with_entries(.value.SignerID = $signerid)' \
    "$MANIFEST_SRC" > "$MANIFEST_FILE"
else
  if [[ ! -f "$MANIFEST_FILE" ]]; then
    echo "Manifest file not found: $MANIFEST_FILE" >&2
    exit 1
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found in PATH" >&2
  exit 1
fi

DOCKER=(docker)
if ! docker version >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n docker version >/dev/null 2>&1; then
    # When falling back to sudo, preserve only the specific env vars this script
    # sets/depends on. This ensures `.env` defaults do not override runtime
    # coordinator addresses and that BuildKit stays enabled for enclave builds.
    SUDO_PRESERVE_ENV="COORDINATOR_MESH_ADDR,COORDINATOR_CLIENT_ADDR,OE_SIMULATION,EGO_VERSION,DOCKER_BUILDKIT"
    DOCKER=(sudo -n --preserve-env="${SUDO_PRESERVE_ENV}" docker)
  fi
fi
if ! "${DOCKER[@]}" version >/dev/null 2>&1; then
  echo "docker is not accessible (daemon not running or permission denied)" >&2
  echo "Try adding your user to the docker group or run with sudo." >&2
  exit 1
fi

if [[ "$INSECURE" != "true" ]] && [[ "$SKIP_SIGNER_CHECK" != "true" ]]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq not found in PATH (required for signer ID checks)" >&2
    exit 1
  fi
  if ! command -v ego >/dev/null 2>&1; then
    echo "ego not found in PATH; will use Docker (ghcr.io/edgelesssys/ego-dev:v${EGO_VERSION:-1.8.0}) for signer ID checks" >&2
  fi
fi

if ! command -v marblerun >/dev/null 2>&1; then
  echo "marblerun not found in PATH" >&2
  exit 1
fi

echo "Using compose: $COMPOSE_FILE"
echo "OE_SIMULATION=$OE_SIMULATION"
echo "COORDINATOR_MESH_ADDR=$COORDINATOR_MESH_ADDR"
echo "COORDINATOR_CLIENT_ADDR=$COORDINATOR_CLIENT_ADDR"
echo "Using manifest: $MANIFEST_FILE"

DOCKER_COMPOSE=("${DOCKER[@]}" compose -f "$COMPOSE_FILE")

resolve_env_file_path() {
  local path="$1"
  if [[ -z "$path" ]]; then
    return 1
  fi
  if [[ "$path" != /* ]]; then
    path="${PROJECT_ROOT}/${path}"
  fi
  if [[ ! -f "$path" ]]; then
    echo "Env file not found: $path" >&2
    exit 1
  fi
  echo "$path"
}

warn_env_file_placeholders() {
  local path="$1"
  if [[ -z "$path" ]] || [[ ! -f "$path" ]]; then
    return 0
  fi

  if grep -Eq '^SUPABASE_URL=.*your-project\.supabase\.co' "$path"; then
    echo "WARNING: SUPABASE_URL in $path still uses the default value from .env.example (your-project.supabase.co)." >&2
  fi
  if grep -Eq '^SUPABASE_SERVICE_KEY=***REMOVED***' "$path"; then
    echo "WARNING: SUPABASE_SERVICE_KEY in $path still uses the default value from .env.example (***REMOVED***)." >&2
  fi
  if grep -Eq '^COORDINATOR_MESH_ADDR=.*\\.svc\\.cluster\\.local' "$path"; then
    echo "WARNING: COORDINATOR_MESH_ADDR in $path looks like a Kubernetes DNS name; Docker Compose marbles should use coordinator:2001." >&2
  fi
}

ENV_FILE_PATH=""
if [[ "$ENV_FILE" != "" ]] && [[ "$NO_ENV_FILE" == "true" ]]; then
  echo "Cannot use --env-file and --no-env-file together" >&2
  exit 2
fi

if [[ "$NO_ENV_FILE" == "true" ]]; then
  EMPTY_ENV_FILE="$(mktemp -t service-layer-empty-env.XXXXXX)"
  cleanup_files+=("$EMPTY_ENV_FILE")
  ENV_FILE_PATH="$EMPTY_ENV_FILE"
elif [[ -n "$ENV_FILE" ]]; then
  ENV_FILE_PATH="$(resolve_env_file_path "$ENV_FILE")"
elif [[ -f "${PROJECT_ROOT}/.env" ]]; then
  ENV_FILE_PATH="${PROJECT_ROOT}/.env"
fi

if [[ -n "$ENV_FILE_PATH" ]]; then
  echo "Using env file: $ENV_FILE_PATH"
  warn_env_file_placeholders "$ENV_FILE_PATH"
  DOCKER_COMPOSE+=(--env-file "$ENV_FILE_PATH")
fi

# Allow configuring the default SGX signing key path once via environment.
# Explicit --signing-key / --signing-key-dir still take precedence.
if [[ -z "$SIGNING_KEY" && -n "${EGO_PRIVATE_KEY_FILE:-}" ]]; then
  SIGNING_KEY="${EGO_PRIVATE_KEY_FILE}"
fi
if [[ -n "$SIGNING_KEY" && "$SIGNING_KEY" != /* ]]; then
  SIGNING_KEY="${PROJECT_ROOT}/${SIGNING_KEY}"
fi
if [[ -n "$SIGNING_KEY" ]]; then
  export EGO_PRIVATE_KEY_FILE="$SIGNING_KEY"
fi

read_env_file_var() {
  local file="$1"
  local key="$2"
  if [[ -z "$file" || ! -f "$file" ]]; then
    return 1
  fi

  local value
  value="$(awk -F= -v key="$key" '
    $0 ~ /^[[:space:]]*#/ { next }
    index($0, key "=") == 1 {
      out = substr($0, length(key) + 2)
      print out
    }
  ' "$file" | tail -n1)"

  if [[ -z "$value" ]]; then
    return 1
  fi

  # Trim optional single/double quotes used in .env files.
  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "$value"
}

resolve_runtime_var() {
  local key="$1"
  local value="${!key:-}"

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
    return 0
  fi

  if value="$(read_env_file_var "$ENV_FILE_PATH" "$key")"; then
    printf '%s' "$value"
    return 0
  fi

  return 1
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON|y|Y) return 0 ;;
    *) return 1 ;;
  esac
}

SUPABASE_URL_VALUE="$(resolve_runtime_var SUPABASE_URL || true)"
SUPABASE_SERVICE_KEY_VALUE="$(resolve_runtime_var SUPABASE_SERVICE_KEY || true)"
GLOBALSIGNER_MASTER_SEED_VALUE="$(resolve_runtime_var GLOBALSIGNER_MASTER_SEED || true)"
TEE_PRIVATE_KEY_VALUE="$(resolve_runtime_var TEE_PRIVATE_KEY || true)"
SECRETS_MASTER_KEY_VALUE="$(resolve_runtime_var SECRETS_MASTER_KEY || true)"
POOL_MASTER_KEY_VALUE="$(resolve_runtime_var POOL_MASTER_KEY || true)"
POOL_ENCRYPTION_KEY_VALUE="$(resolve_runtime_var POOL_ENCRYPTION_KEY || true)"
COMPUTE_MASTER_KEY_VALUE="$(resolve_runtime_var COMPUTE_MASTER_KEY || true)"
NEOFEEDS_SIGNING_KEY_VALUE="$(resolve_runtime_var NEOFEEDS_SIGNING_KEY || true)"
NEOVRF_SIGNING_KEY_VALUE="$(resolve_runtime_var NEOVRF_SIGNING_KEY || true)"
NEO_TESTNET_WIF_VALUE="$(resolve_runtime_var NEO_TESTNET_WIF || true)"
NEO_RPC_URL_VALUE="$(resolve_runtime_var NEO_RPC_URL || true)"
NEO_NETWORK_MAGIC_VALUE="$(resolve_runtime_var NEO_NETWORK_MAGIC || true)"

if [[ -z "$SUPABASE_URL_VALUE" || -z "$SUPABASE_SERVICE_KEY_VALUE" ]]; then
  echo "SUPABASE_URL and SUPABASE_SERVICE_KEY are required for MarbleRun services." >&2
  echo "Set them in the environment or ${ENV_FILE_PATH:-PROJECT_ROOT/.env} before running this script." >&2
  exit 1
fi
if [[ -z "$GLOBALSIGNER_MASTER_SEED_VALUE" ]]; then
  echo "GLOBALSIGNER_MASTER_SEED is required for deterministic GlobalSigner signatures." >&2
  echo "Set it in the environment or ${ENV_FILE_PATH:-PROJECT_ROOT/.env} before running this script." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found in PATH (required to inject runtime SUPABASE_* values into the manifest)" >&2
  exit 1
fi

MANIFEST_WITH_RUNTIME_ENV="$(mktemp -t service-layer-manifest.runtime.XXXXXX.json)"
cleanup_files+=("$MANIFEST_WITH_RUNTIME_ENV")
jq \
  --arg supabase_url "$SUPABASE_URL_VALUE" \
  --arg supabase_service_key "$SUPABASE_SERVICE_KEY_VALUE" \
  --arg globalsigner_master_seed "$GLOBALSIGNER_MASTER_SEED_VALUE" \
  --arg tee_private_key "$TEE_PRIVATE_KEY_VALUE" \
  --arg secrets_master_key "$SECRETS_MASTER_KEY_VALUE" \
  --arg pool_master_key "$POOL_MASTER_KEY_VALUE" \
  --arg pool_encryption_key "$POOL_ENCRYPTION_KEY_VALUE" \
  --arg compute_master_key "$COMPUTE_MASTER_KEY_VALUE" \
  --arg neofeeds_signing_key "$NEOFEEDS_SIGNING_KEY_VALUE" \
  --arg neovrf_signing_key "$NEOVRF_SIGNING_KEY_VALUE" \
  '.Marbles |= with_entries(
      .value.Parameters.Env.SUPABASE_URL = $supabase_url |
      .value.Parameters.Env.SUPABASE_SERVICE_KEY = $supabase_service_key |
      .value.Parameters.Env |= (
        if has("GLOBALSIGNER_MASTER_SEED") then .GLOBALSIGNER_MASTER_SEED = $globalsigner_master_seed else . end |
        if $tee_private_key != "" and has("TEE_PRIVATE_KEY") then .TEE_PRIVATE_KEY = $tee_private_key else . end |
        if $secrets_master_key != "" and has("SECRETS_MASTER_KEY") then .SECRETS_MASTER_KEY = $secrets_master_key else . end |
        if $pool_master_key != "" and has("POOL_MASTER_KEY") then .POOL_MASTER_KEY = $pool_master_key else . end |
        if $pool_encryption_key != "" and has("POOL_ENCRYPTION_KEY") then .POOL_ENCRYPTION_KEY = $pool_encryption_key else . end |
        if $compute_master_key != "" and has("COMPUTE_MASTER_KEY") then .COMPUTE_MASTER_KEY = $compute_master_key else . end |
        if $neofeeds_signing_key != "" and has("NEOFEEDS_SIGNING_KEY") then .NEOFEEDS_SIGNING_KEY = $neofeeds_signing_key else . end |
        if $neovrf_signing_key != "" and has("NEOVRF_SIGNING_KEY") then .NEOVRF_SIGNING_KEY = $neovrf_signing_key else . end
      )
    )' \
  "$MANIFEST_FILE" > "$MANIFEST_WITH_RUNTIME_ENV"
MANIFEST_FILE="$MANIFEST_WITH_RUNTIME_ENV"

default_service_binary() {
  local pkg="$1"
  case "$pkg" in
    neoaccounts) echo "accountpool" ;;
    *) echo "$pkg" ;;
  esac
}

resolve_signing_key() {
  local pkg="$1"
  if [[ -n "$SIGNING_KEY" ]]; then
    echo "$SIGNING_KEY"
    return 0
  fi
  if [[ -n "$SIGNING_KEY_DIR" ]]; then
    local candidates=(
      "${SIGNING_KEY_DIR}/${pkg}.pem"
      "${SIGNING_KEY_DIR}/${pkg}-private.pem"
      "${SIGNING_KEY_DIR}/${pkg}.key"
      "${SIGNING_KEY_DIR}/${pkg}-private.key"
    )
    local candidate
    for candidate in "${candidates[@]}"; do
      if [[ -f "$candidate" ]]; then
        echo "$candidate"
        return 0
      fi
    done
  fi
  return 1
}

looks_like_pem_private_key() {
  local key_path="$1"
  # Accept common PEM private-key headers used for enclave signing keys.
  grep -Eq '^-----BEGIN (EC |RSA |ENCRYPTED )?PRIVATE KEY-----' "$key_path"
}

ego_image() {
  echo "ghcr.io/edgelesssys/ego-dev:v${EGO_VERSION:-1.8.0}"
}

ego_signerid() {
  local key_path="$1"
  if command -v ego >/dev/null 2>&1; then
    ego signerid "$key_path"
    return $?
  fi

  local image
  image="$(ego_image)"
  "${DOCKER[@]}" run --rm -v "${key_path}:/signing-key:ro" "$image" ego signerid /signing-key
}

ego_signerid_from_private_key() {
  local key_path="$1"

  local signer
  signer="$(ego_signerid "$key_path" 2>/dev/null | tr -d '\r\n' || true)"
  if [[ "$signer" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "$signer"
    return 0
  fi

  # Some tooling expects a public key or cert. Derive a public key and retry.
  if command -v openssl >/dev/null 2>&1; then
    local tmp_pub
    tmp_pub="$(mktemp -t service-layer-signingkey.pub.XXXXXX.pem)"
    if ! openssl rsa -in "$key_path" -pubout -out "$tmp_pub" >/dev/null 2>&1; then
      rm -f "$tmp_pub"
      return 1
    fi
    signer="$(ego_signerid "$tmp_pub" 2>/dev/null | tr -d '\r\n' || true)"
    rm -f "$tmp_pub"
    if [[ "$signer" =~ ^[0-9a-fA-F]{64}$ ]]; then
      echo "$signer"
      return 0
    fi
  fi

  # Final fallback: derive and compute inside the EGo tool image (avoids host openssl dependency).
  local image
  image="$(ego_image)"
  signer="$("${DOCKER[@]}" run --rm -v "${key_path}:/signing-key:ro" "$image" sh -c 'openssl rsa -in /signing-key -pubout -out /tmp/pub.pem >/dev/null 2>&1 && ego signerid /tmp/pub.pem' 2>/dev/null | tr -d '\r\n' || true)"
  if [[ "$signer" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "$signer"
    return 0
  fi

  return 1
}

build_signed_images() {
  local packages=(
    neofeeds
    neoflow
    neoaccounts
    neocompute
    neovrf
    neooracle
    neorequests
    txproxy
    neogasbank
    neosimulation
    globalsigner
  )
  local pkg

  export DOCKER_BUILDKIT=1

  for pkg in "${packages[@]}"; do
    local key_path
    if ! key_path="$(resolve_signing_key "$pkg")"; then
      echo "Missing signing key for package '${pkg}'. Provide --signing-key or --signing-key-dir." >&2
      exit 1
    fi
    if [[ ! -r "$key_path" ]]; then
      echo "Signing key not readable: $key_path" >&2
      exit 1
    fi
    if ! looks_like_pem_private_key "$key_path"; then
      echo "Signing key file does not look like a PEM private key: $key_path" >&2
      echo "Provide a real enclave signing key (placeholder text files are not valid)." >&2
      exit 1
    fi

    if [[ "$SKIP_SIGNER_CHECK" != "true" ]]; then
      local expected actual
      expected="$(jq -r --arg pkg "$pkg" '.Packages[$pkg].SignerID' "$MANIFEST_FILE")"
      actual="$(ego_signerid_from_private_key "$key_path" || true)"
      if [[ -z "$expected" || "$expected" == "null" ]]; then
        echo "Manifest does not define Packages.${pkg}.SignerID" >&2
        exit 1
      fi
      if [[ -z "$actual" ]]; then
        echo "Unable to compute SignerID from signing key: $key_path" >&2
        echo "Install the `ego` CLI or ensure Docker can pull $(ego_image), or use --skip-signer-check." >&2
        exit 1
      fi
      if [[ "$expected" != "$actual" ]]; then
        echo "SignerID mismatch for '${pkg}': manifest expects ${expected}, signing key yields ${actual}" >&2
        echo "Either provide the correct key for this package or update manifests/manifest.json." >&2
        exit 1
      fi
    fi

    local service_binary
    service_binary="$(default_service_binary "$pkg")"
    echo "Building signed image: service-layer/${pkg}:latest (SERVICE=${service_binary})"
    "${DOCKER[@]}" build \
      --secret id=ego_private_key,src="$key_path" \
      --build-arg EGO_STRICT_SIGNING=1 \
      --build-arg EGO_VERSION="${EGO_VERSION:-1.8.0}" \
      --build-arg SERVICE="${service_binary}" \
      -f "${PROJECT_ROOT}/docker/Dockerfile.service" \
      -t "service-layer/${pkg}:latest" \
      "${PROJECT_ROOT}"
  done
}

if [[ "$INSECURE" != "true" ]]; then
  # In SGX hardware mode, images must be signed with stable keys that match the
  # MarbleRun manifest. Docker Compose cannot pass BuildKit secrets, so we
  # (optionally) build signed images here and always start with --no-build.
  if [[ "$NO_BUILD" != "true" ]] && { [[ -n "$SIGNING_KEY" ]] || [[ -n "$SIGNING_KEY_DIR" ]]; }; then
    build_signed_images
  elif [[ "$NO_BUILD" != "true" ]]; then
    echo "No signing key provided. Starting without building images." >&2
    echo "Provide --signing-key / --signing-key-dir to build locally, or ensure images are available locally/registries." >&2
  fi
  NO_BUILD="true"
fi

compose_up_args=(up -d)
if [[ "$NO_BUILD" == "true" ]]; then
  compose_up_args+=(--no-build)
fi

# Start the coordinator first so marbles don't crash-loop while the coordinator
# is still waiting for a manifest.
"${DOCKER_COMPOSE[@]}" "${compose_up_args[@]}" coordinator

wait_for_tcp() {
  local addr="$1"
  local host="${addr%:*}"
  local port="${addr##*:}"
  local deadline="$((SECONDS + 60))"

  while (( SECONDS < deadline )); do
    if timeout 1 bash -c ">/dev/tcp/${host}/${port}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  return 1
}

wait_for_coordinator_api() {
  local deadline="$((SECONDS + 60))"
  while (( SECONDS < deadline )); do
    if marblerun status "$COORDINATOR_CLIENT_ADDR" "${MARBLERUN_FLAGS[@]}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  return 1
}

maybe_fund_txproxy_signer() {
  local auto_fund="${AUTO_FUND_TXPROXY_SIGNER:-}"
  if [[ -z "$auto_fund" ]]; then
    if [[ "$INSECURE" == "true" ]]; then
      auto_fund="1"
    else
      auto_fund="0"
    fi
  fi
  if ! is_truthy "$auto_fund"; then
    return 0
  fi

  if ! command -v go >/dev/null 2>&1; then
    echo "Warning: go not found; skipping txproxy signer auto-funding." >&2
    return 0
  fi

  if [[ -z "$NEO_TESTNET_WIF_VALUE" ]]; then
    echo "Warning: NEO_TESTNET_WIF is not set; skipping txproxy signer auto-funding." >&2
    if is_truthy "${AUTO_FUND_TXPROXY_SIGNER_REQUIRED:-0}"; then
      return 1
    fi
    return 0
  fi

  local min_gas="${TXPROXY_SIGNER_MIN_GAS:-30}"
  local topup_gas="${TXPROXY_SIGNER_TOPUP_GAS:-100}"

  echo "Ensuring txproxy signer balance >= ${min_gas} GAS (top-up amount: ${topup_gas} GAS)..."
  local -a env_args
  env_args=(
    "NEO_TESTNET_WIF=${NEO_TESTNET_WIF_VALUE}"
    "GAS_TRANSFER_MIN_BALANCE=${min_gas}"
    "GAS_TRANSFER_AMOUNT=${topup_gas}"
  )
  if [[ -n "$NEO_RPC_URL_VALUE" ]]; then
    env_args+=("NEO_RPC_URL=${NEO_RPC_URL_VALUE}")
  fi
  if [[ -n "$NEO_NETWORK_MAGIC_VALUE" ]]; then
    env_args+=("NEO_NETWORK_MAGIC=${NEO_NETWORK_MAGIC_VALUE}")
  fi

  if ! (
    cd "$PROJECT_ROOT" && env "${env_args[@]}" go run -tags=scripts scripts/transfer_gas_to_signer.go
  ); then
    echo "Warning: txproxy signer auto-funding failed." >&2
    if is_truthy "${AUTO_FUND_TXPROXY_SIGNER_REQUIRED:-0}"; then
      return 1
    fi
  fi
}

set_manifest_with_retries() {
  local attempts="${1:-10}"
  local sleep_seconds="${2:-2}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if marblerun manifest set "$MANIFEST_FILE" "$COORDINATOR_CLIENT_ADDR" "${MARBLERUN_FLAGS[@]}"; then
      return 0
    fi
    echo "Warning: 'marblerun manifest set' failed (attempt ${attempt}/${attempts})." >&2
    if (( attempt < attempts )); then
      sleep "$sleep_seconds"
    fi
  done

  return 1
}

coordinator_requires_manifest() {
  local status_out
  status_out="$(marblerun status "$COORDINATOR_CLIENT_ADDR" "${MARBLERUN_FLAGS[@]}" 2>&1 || true)"
  echo "$status_out" | grep -Eiq 'recovery mode|waiting for (a )?manifest|ready to accept a manifest'
}

echo "Waiting for coordinator at ${COORDINATOR_CLIENT_ADDR}..."
if ! wait_for_tcp "$COORDINATOR_CLIENT_ADDR"; then
  echo "Coordinator not reachable at ${COORDINATOR_CLIENT_ADDR} (timeout)" >&2
  exit 1
fi

if ! wait_for_coordinator_api; then
  echo "Warning: Coordinator API was slow to initialize; continuing with manifest retries." >&2
fi

if coordinator_requires_manifest; then
  if ! set_manifest_with_retries 10 2; then
    echo "Warning: 'marblerun manifest set' failed after retries." >&2
    if coordinator_requires_manifest; then
      if marblerun manifest update apply --help >/dev/null 2>&1; then
        if ! marblerun manifest update apply "$MANIFEST_FILE" "$COORDINATOR_CLIENT_ADDR" "${MARBLERUN_FLAGS[@]}"; then
          echo "Error: failed to configure coordinator manifest (set + update both failed)." >&2
          exit 1
        fi
      else
        echo "Error: coordinator still requires a manifest and update command is unavailable." >&2
        exit 1
      fi
    fi
  fi
else
  echo "Coordinator already has an active manifest; skipping manifest set." >&2
  if marblerun manifest update apply --help >/dev/null 2>&1; then
    echo "Applying manifest update to running coordinator..." >&2
    if ! marblerun manifest update apply "$MANIFEST_FILE" "$COORDINATOR_CLIENT_ADDR" "${MARBLERUN_FLAGS[@]}"; then
      echo "Warning: failed to apply manifest update; existing manifest remains active." >&2
      echo "If required, reset coordinator state (e.g. docker compose -f ${COMPOSE_FILE} down -v)." >&2
    fi
  else
    echo "If you changed ${MANIFEST_FILE}, reset coordinator state first (e.g. docker compose -f ${COMPOSE_FILE} down -v)." >&2
  fi
fi

marblerun status "$COORDINATOR_CLIENT_ADDR" "${MARBLERUN_FLAGS[@]}" || true

# Now that the manifest is set, start (or update) the rest of the stack.
"${DOCKER_COMPOSE[@]}" "${compose_up_args[@]}"

if ! maybe_fund_txproxy_signer; then
  echo "Error: txproxy signer auto-funding failed and is required." >&2
  exit 1
fi
