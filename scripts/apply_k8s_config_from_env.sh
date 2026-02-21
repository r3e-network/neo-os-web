#!/bin/bash
#
# Apply Kubernetes ConfigMap `service-layer-config` from an env file.
# This keeps non-secret runtime config (contract hashes, RPC URLs, allowlists)
# in sync with local `.env` without committing values to git.
#
# Usage:
#   ./scripts/apply_k8s_config_from_env.sh [--namespace service-layer] [--name service-layer-config] [--env-file .env]
#
set -euo pipefail

NAMESPACE="service-layer"
CONFIGMAP_NAME="service-layer-config"
ENV_FILE=".env"
DRY_RUN=false

ALLOWED_KEYS=(
  "MARBLE_ENV"
  "LOG_LEVEL"
  "LOG_FORMAT"
  "METRICS_ENABLED"
  "METRICS_PORT"
  "TRACING_ENABLED"
  "TRACING_ENDPOINT"
  "SUPABASE_URL"
  "SUPABASE_REST_PREFIX"
  "SUPABASE_ALLOW_INSECURE"
  "NEO_RPC_URL"
  "NEO_RPC_URLS"
  "NEO_NETWORK_MAGIC"
  "NEO_EVENT_START_BLOCK"
  "CONTRACT_PAYMENTHUB_HASH"
  "CONTRACT_GOVERNANCE_HASH"
  "CONTRACT_PRICEFEED_HASH"
  "CONTRACT_RANDOMNESSLOG_HASH"
  "CONTRACT_APPREGISTRY_HASH"
  "CONTRACT_AUTOMATIONANCHOR_HASH"
  "CONTRACT_SERVICEGATEWAY_HASH"
  "ORACLE_HTTP_ALLOWLIST"
  "ARBITRUM_RPC"
  "NEOFLOW_WEBHOOK_ALLOW_PRIVATE_NETWORKS"
  "NEOFEEDS_URL"
  "NEOFLOW_URL"
  "NEOCOMPUTE_URL"
  "NEOVRF_URL"
  "NEOORACLE_URL"
  "TXPROXY_URL"
  "TXPROXY_TIMEOUT"
  "GASBANK_URL"
  "NEOACCOUNTS_SERVICE_URL"
  "GASBANK_DEPOSIT_ADDRESS"
  "GLOBALSIGNER_SERVICE_URL"
  "NEOREQUESTS_MAX_RESULT_BYTES"
  "NEOREQUESTS_MAX_ERROR_LEN"
  "NEOREQUESTS_RNG_RESULT_MODE"
  "NEOREQUESTS_TX_WAIT"
  "NEOREQUESTS_ENFORCE_APPREGISTRY"
  "NEOREQUESTS_APPREGISTRY_CACHE_SECONDS"
  "TXPROXY_ALLOWLIST"
  "SIMULATION_ENABLED"
  "SIMULATION_MINIAPPS"
  "SIMULATION_TX_INTERVAL_MIN_MS"
  "SIMULATION_TX_INTERVAL_MAX_MS"
  "SIMULATION_WORKERS_PER_APP"
)

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --namespace <ns>   Kubernetes namespace (default: service-layer)
  --name <name>      ConfigMap name (default: service-layer-config)
  --env-file <path>  Path to env file (default: .env)
  --dry-run          Print the patch without applying
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="$2"; shift 2;;
    --name)
      CONFIGMAP_NAME="$2"; shift 2;;
    --env-file)
      ENV_FILE="$2"; shift 2;;
    --dry-run)
      DRY_RUN=true; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it from .env.example first." >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found. Install kubectl to apply config." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install Python 3 to parse env files." >&2
  exit 1
fi

ALLOWED_KEYS_ENV=$(printf "%s\n" "${ALLOWED_KEYS[@]}")

PATCH_JSON=$(
  ENV_FILE="$ENV_FILE" ALLOWED_KEYS="$ALLOWED_KEYS_ENV" python3 - <<'PY'
import json
import os
import sys

allowed = set(filter(None, os.environ.get("ALLOWED_KEYS", "").splitlines()))
if not allowed:
    sys.stderr.write("No allowed keys configured; refusing to patch ConfigMap.\n")
    sys.exit(2)

data = {}
env_path = os.environ["ENV_FILE"]
with open(env_path, "r", encoding="utf-8") as handle:
    for raw in handle:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key not in allowed:
            continue
        value = value.strip()
        if not value:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        data[key] = value

if not data:
    sys.stderr.write("No allowed keys found in env file.\n")
    sys.exit(2)

print(json.dumps({"data": data}))
PY
)

if [[ "$DRY_RUN" == "true" ]]; then
  kubectl patch configmap "$CONFIGMAP_NAME" \
    --namespace "$NAMESPACE" \
    --type merge \
    --patch "$PATCH_JSON" \
    --dry-run=client -o yaml
  exit 0
fi

kubectl patch configmap "$CONFIGMAP_NAME" \
  --namespace "$NAMESPACE" \
  --type merge \
  --patch "$PATCH_JSON"

echo "Applied ConfigMap $CONFIGMAP_NAME in namespace $NAMESPACE from $ENV_FILE"
