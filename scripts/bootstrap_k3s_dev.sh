#!/bin/bash
#
# Bootstrap full local k3s dev stack:
# - k3s + MarbleRun + cert-manager
# - Supabase (local) in k3s
# - service-layer marbles
# - Edge gateway + mTLS
#
# Usage:
#   ./scripts/bootstrap_k3s_dev.sh [--env-file .env] [--edge-env-file .env.local]
#
set -euo pipefail

ENV_FILE=".env"
EDGE_ENV_FILE=".env.local"

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap_k3s_dev.sh [OPTIONS]

Options:
  --env-file <path>       Path to env file for service-layer config (default: .env)
  --edge-env-file <path>  Path to env file for Edge secrets (default: .env.local)
  -h, --help              Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"; shift 2;;
    --edge-env-file)
      EDGE_ENV_FILE="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$EDGE_ENV_FILE" ]]; then
  echo "Missing edge env file: $EDGE_ENV_FILE" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found in PATH" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found in PATH" >&2
  exit 1
fi

SUDO=(sudo)
if [[ -z "${ROOT_PASSWORD:-}" ]]; then
  ROOT_PASSWORD=$(awk -F= '$1=="ROOT_PASSWORD"{sub($1"=",""); print}' "$ENV_FILE" | tail -n1)
fi
if [[ -z "${ROOT_PASSWORD:-}" ]]; then
  ROOT_PASSWORD=$(awk -F= '$1=="ROOT_PASSWORD"{sub($1"=",""); print}' "$EDGE_ENV_FILE" | tail -n1)
fi
if [[ -n "${ROOT_PASSWORD:-}" ]]; then
  echo "$ROOT_PASSWORD" | sudo -S -v >/dev/null
  SUDO=(sudo -n)
fi

echo "=== k3s dev stack bootstrap ==="
echo "Env file: $ENV_FILE"
echo "Edge env file: $EDGE_ENV_FILE"

echo ""
echo "[1/6] Installing k3s + MarbleRun + cert-manager..."
./scripts/k3s-local-setup.sh install

echo ""
echo "[2/6] Deploying local Supabase into k3s..."
./scripts/supabase-k3s.sh deploy

echo ""
echo "[3/6] Applying secrets + config..."
./scripts/apply_k8s_secrets_from_env.sh --env-file "$EDGE_ENV_FILE"
./scripts/apply_k8s_config_from_env.sh --env-file "$ENV_FILE"

echo ""
echo "[4/6] Deploying service-layer marbles..."
./scripts/deploy_k8s.sh --env dev

echo ""
echo "[5/6] Building + deploying Edge gateway..."
docker build -f platform/edge/k8s.dockerfile -t service-layer/edge-gateway:latest platform/edge
docker save service-layer/edge-gateway:latest | "${SUDO[@]}" k3s ctr images import -
./scripts/apply_edge_secrets_from_env.sh --env-file "$EDGE_ENV_FILE"
kubectl apply -k k8s/platform/edge

echo ""
echo "[6/6] Setting up Edge ↔ TEE mTLS..."
./scripts/setup_edge_mtls.sh --env-file "$EDGE_ENV_FILE"

echo ""
echo "✅ Bootstrap complete."
echo ""
echo "Next steps:"
echo "  1. Map edge.localhost in /etc/hosts to your k3s node IP."
echo "  2. Validate workflows with scripts in ./scripts (see docs/WORKFLOWS.md)."
