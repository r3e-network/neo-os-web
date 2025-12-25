#!/bin/bash
#
# Setup mTLS for Edge gateway -> TEE services (local k3s).
# - Generates an Edge client CA + cert if missing
# - Extracts MarbleRun root CA from a running service pod
# - Creates/updates the edge-client-ca ConfigMap (service-layer)
# - Creates/updates edge-gateway-secrets with mTLS material (platform)
#
# Usage:
#   ./scripts/setup_edge_mtls.sh [--env-file .env.local] [--edge-dir secrets/edge-mtls]
#
set -euo pipefail

ENV_FILE=".env.local"
EDGE_DIR="secrets/edge-mtls"

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --env-file <path>  Path to env file (default: .env.local)
  --edge-dir <path>  Directory for generated certs (default: secrets/edge-mtls)
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"; shift 2;;
    --edge-dir)
      EDGE_DIR="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1;;
  esac
done

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found. Install kubectl to apply secrets." >&2
  exit 1
fi

# Default to the user kubeconfig if present (k3s shim may be root-only).
if [[ -z "${KUBECONFIG:-}" && -f "$HOME/.kube/config" ]]; then
  export KUBECONFIG="$HOME/.kube/config"
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl not found. Install openssl to generate certificates." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it from .env.example first." >&2
  exit 1
fi

mkdir -p "$EDGE_DIR"

CA_KEY="$EDGE_DIR/edge-ca.key"
CA_CERT="$EDGE_DIR/edge-ca.crt"
CLIENT_KEY="$EDGE_DIR/edge-client.key"
CLIENT_CSR="$EDGE_DIR/edge-client.csr"
CLIENT_CERT="$EDGE_DIR/edge-client.crt"
MARBLE_CA="$EDGE_DIR/marblerun-root-ca.pem"

if [[ ! -f "$CA_KEY" || ! -f "$CA_CERT" ]]; then
  echo "[edge-mtls] Generating edge client CA..."
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -subj "/CN=edge-client-ca" \
    -keyout "$CA_KEY" -out "$CA_CERT" >/dev/null 2>&1
fi

if [[ ! -f "$CLIENT_KEY" || ! -f "$CLIENT_CERT" ]]; then
  echo "[edge-mtls] Generating edge client certificate..."
  openssl req -newkey rsa:2048 -nodes \
    -subj "/CN=edge-gateway" \
    -keyout "$CLIENT_KEY" -out "$CLIENT_CSR" >/dev/null 2>&1
  openssl x509 -req -in "$CLIENT_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" \
    -CAcreateserial -days 365 -out "$CLIENT_CERT" >/dev/null 2>&1
  rm -f "$CLIENT_CSR"
fi

if [[ ! -s "$MARBLE_CA" ]]; then
  echo "[edge-mtls] Extracting MarbleRun root CA from service-layer..."
  if command -v marblerun >/dev/null 2>&1; then
    echo "[edge-mtls] Fetching root CA from Coordinator..."
    kubectl -n marblerun port-forward svc/coordinator-client-api 4433:4433 >/tmp/portforward-marblerun.log 2>&1 &
    pf_pid=$!
    trap 'kill "$pf_pid" >/dev/null 2>&1 || true' EXIT
    sleep 1
    marblerun certificate chain localhost:4433 --insecure --output "$MARBLE_CA" >/dev/null 2>&1 || true
    kill "$pf_pid" >/dev/null 2>&1 || true
    trap - EXIT
  else
    pod=$(kubectl -n service-layer get pods -l app=neofeeds -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$pod" ]]; then
      echo "Unable to locate neofeeds pod to extract MARBLE_ROOT_CA." >&2
      exit 1
    fi
    kubectl -n service-layer exec "$pod" -- sh -c 'printf "%s" "$MARBLE_ROOT_CA"' > "$MARBLE_CA"
  fi
fi

if [[ ! -s "$MARBLE_CA" ]]; then
  echo "[edge-mtls] WARNING: MARBLE_ROOT_CA unavailable; proceeding without server CA." >&2
  rm -f "$MARBLE_CA"
fi

echo "[edge-mtls] Updating edge-client-ca ConfigMap..."
kubectl -n service-layer create configmap edge-client-ca \
  --from-file=ca.pem="$CA_CERT" \
  --dry-run=client -o yaml | kubectl apply -f -

SUPABASE_ANON_KEY=$(awk -F= '$1=="SUPABASE_ANON_KEY"{sub($1"=",""); print}' "$ENV_FILE" | tail -n1)
SUPABASE_SERVICE_KEY=$(awk -F= '$1=="SUPABASE_SERVICE_KEY"{sub($1"=",""); print}' "$ENV_FILE" | tail -n1)
SUPABASE_SERVICE_ROLE_KEY=$(awk -F= '$1=="SUPABASE_SERVICE_ROLE_KEY"{sub($1"=",""); print}' "$ENV_FILE" | tail -n1)

if [[ -z "$SUPABASE_ANON_KEY" || -z "$SUPABASE_SERVICE_KEY" ]]; then
  echo "SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY missing in $ENV_FILE." >&2
  exit 1
fi

echo "[edge-mtls] Updating edge-gateway-secrets..."
secret_args=(
  --from-literal=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
  --from-literal=SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_SERVICE_KEY}"
  --from-file=TEE_MTLS_CERT_PEM="$CLIENT_CERT"
  --from-file=TEE_MTLS_KEY_PEM="$CLIENT_KEY"
)
if [[ -s "$MARBLE_CA" ]]; then
  secret_args+=(--from-file=TEE_MTLS_ROOT_CA_PEM="$MARBLE_CA")
fi

kubectl -n platform create secret generic edge-gateway-secrets \
  "${secret_args[@]}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "[edge-mtls] Restarting service-layer + edge-gateway deployments..."
kubectl -n service-layer rollout restart deployment
kubectl -n platform rollout restart deployment/edge-gateway

echo "[edge-mtls] Done."
