#!/usr/bin/env bash
set -euo pipefail

# Nitro-oriented local k3s bootstrap helper.
# This script intentionally avoids legacy device-plugin configuration.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage: ./scripts/k3s-install.sh <install|status|cleanup>

Commands:
  install   Install k3s for local Kubernetes-native service mesh mode.
  status    Show k3s and local service status.
  cleanup   Uninstall k3s.
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

setup_kubeconfig() {
  mkdir -p "$HOME/.kube"
  sudo cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
  sudo chown "$(id -u):$(id -g)" "$HOME/.kube/config"
  chmod 600 "$HOME/.kube/config"
}

install_k3s() {
  echo "Installing k3s..."
  curl -sfL https://get.k3s.io | sh -
  setup_kubeconfig

  echo "Waiting for node readiness..."
  kubectl wait --for=condition=Ready node --all --timeout=180s

  echo "Using Kubernetes-native local service mesh mode (no NitroRun coordinator)."

  echo "k3s install completed (Nitro-oriented local profile)."
}

show_status() {
  require_cmd kubectl
  echo "== Nodes =="
  kubectl get nodes -o wide
  echo ""
  echo "== Service Layer namespaces =="
  kubectl get ns service-layer supabase platform cert-manager 2>/dev/null || true
}

cleanup_k3s() {
  if [[ -x /usr/local/bin/k3s-uninstall.sh ]]; then
    echo "Uninstalling k3s..."
    sudo /usr/local/bin/k3s-uninstall.sh
    echo "Cleanup completed."
    return
  fi
  echo "k3s uninstall script not found. Nothing to do."
}

main() {
  cmd="${1:-}"
  case "$cmd" in
    install)
      require_cmd curl
      install_k3s
      ;;
    status)
      show_status
      ;;
    cleanup)
      cleanup_k3s
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
