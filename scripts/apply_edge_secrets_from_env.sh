#!/bin/bash
#
# Apply Kubernetes Secret `edge-gateway-secrets` from an env file (default: .env.local).
# This keeps Edge gateway auth keys in sync without committing secrets.
#
# Usage:
#   ./scripts/apply_edge_secrets_from_env.sh [--namespace platform] [--name edge-gateway-secrets] [--env-file .env.local]
#
set -euo pipefail

NAMESPACE="platform"
SECRET_NAME="edge-gateway-secrets"
ENV_FILE=".env.local"
DRY_RUN=false

ALLOWED_KEYS=(
  "SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "SECRETS_MASTER_KEY"
  "EDGE_MTLS_CERT_PEM"
  "EDGE_MTLS_KEY_PEM"
  "EDGE_MTLS_ROOT_CA_PEM"
  "TEE_MTLS_CERT_PEM"
  "TEE_MTLS_KEY_PEM"
  "TEE_MTLS_ROOT_CA_PEM"
)

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --namespace <ns>   Kubernetes namespace (default: platform)
  --name <name>      Secret name (default: edge-gateway-secrets)
  --env-file <path>  Path to env file (default: .env.local)
  --dry-run          Print generated Secret YAML without applying
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="$2"; shift 2;;
    --name)
      SECRET_NAME="$2"; shift 2;;
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
  echo "kubectl not found. Install kubectl to apply secrets." >&2
  exit 1
fi

tmp_env=$(mktemp)
trap 'rm -f "$tmp_env"' EXIT

skipped_empty_keys=()

while IFS= read -r line || [[ -n "$line" ]]; do
  trimmed="${line#"${line%%[![:space:]]*}"}"
  [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
  if [[ "$trimmed" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    for allowed in "${ALLOWED_KEYS[@]}"; do
      if [[ "$key" == "$allowed" ]]; then
        if [[ -z "$value" ]]; then
          skipped_empty_keys+=("$key")
          break
        fi
        echo "$trimmed" >> "$tmp_env"
        break
      fi
    done
  fi
done < "$ENV_FILE"

if [[ "${#skipped_empty_keys[@]}" -gt 0 ]]; then
  echo "Skipping empty keys (not applied to Secret): ${skipped_empty_keys[*]}" >&2
fi

if [[ "$DRY_RUN" == "true" ]]; then
  kubectl create secret generic "$SECRET_NAME" \
    --from-env-file="$tmp_env" \
    --namespace="$NAMESPACE" \
    --dry-run=client -o yaml
  exit 0
fi

kubectl create secret generic "$SECRET_NAME" \
  --from-env-file="$tmp_env" \
  --namespace="$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applied Secret $SECRET_NAME in namespace $NAMESPACE from $ENV_FILE"
