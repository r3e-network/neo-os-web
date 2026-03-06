#!/bin/bash
#
# Installation script for Nitro-oriented local development tooling.
# Target: Ubuntu 24.04 LTS
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        log_warn "Some operations require sudo. You may be prompted for password."
    fi
}

require_apt() {
    if ! command -v apt-get >/dev/null 2>&1; then
        log_error "scripts/install_dev_env.sh currently supports apt-based hosts only (for example Ubuntu 24.04). Install the required tools manually on this host."
        return 1
    fi
}

install_prerequisites() {
    log_info "Installing prerequisites..."
    sudo apt-get update
    sudo apt-get install -y \
        build-essential \
        libssl-dev \
        curl \
        wget \
        gnupg \
        apt-transport-https \
        ca-certificates \
        software-properties-common
    log_info "Prerequisites installed."
}

install_nitro_tools() {
    log_info "Installing AWS Nitro Enclaves tooling..."
    if sudo apt-get install -y aws-nitro-enclaves-cli >/dev/null 2>&1; then
        log_info "aws-nitro-enclaves-cli installed."
    else
        log_warn "aws-nitro-enclaves-cli package not found in apt repositories."
        log_warn "Install Nitro tooling manually per AWS documentation."
    fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

install_nitrorun() {
    log_info "Installing NitroRun-compatible CLI..."

    if command -v nitrorun >/dev/null 2>&1; then
        log_info "NitroRun CLI already installed: $(nitrorun version 2>/dev/null || echo 'installed')"
        return 0
    fi

    local arch
    arch="$(uname -m)"

    local asset_url
    case "$arch" in
        x86_64|amd64)
            asset_url="https://github.com/edgelesssys/marblerun/releases/latest/download/marblerun-x86_64.AppImage"
            ;;
        *)
            log_error "Automatic NitroRun-compatible install is only supported on x86_64 hosts (detected: $arch)."
            log_warn "Install a compatible coordinator CLI manually and expose it as 'nitrorun' in PATH."
            return 1
            ;;
    esac

    curl -fsSL "$asset_url" -o /tmp/nitrorun

    chmod +x /tmp/nitrorun
    sudo mv /tmp/nitrorun /usr/local/bin/nitrorun

    if command -v nitrorun >/dev/null 2>&1; then
        log_info "NitroRun CLI installed: $(nitrorun version 2>/dev/null || echo 'installed')"
    else
        log_error "NitroRun CLI installation failed"
        return 1
    fi
}

deploy_nitrorun() {
    log_info "Deploying NitroRun coordinator to Kubernetes..."

    if kubectl -n nitrorun get deployment coordinator >/dev/null 2>&1; then
        log_info "NitroRun coordinator already installed."
        return 0
    fi

    nitrorun install --simulation || {
        log_error "Failed to install NitroRun coordinator"
        return 1
    }

    log_info "Waiting for NitroRun coordinator components..."
    nitrorun check --timeout 180s || {
        log_warn "NitroRun coordinator may not be fully ready yet; showing current status."
        kubectl -n nitrorun get deploy,pods,svc || true
    }
}

install_k3s() {
    log_info "Installing k3s (lightweight Kubernetes)..."

    curl -sfL https://get.k3s.io | sh -

    log_info "Waiting for k3s to be ready..."
    sleep 10

    mkdir -p ~/.kube
    sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
    sudo chown $(id -u):$(id -g) ~/.kube/config
    chmod 600 ~/.kube/config

    if ! grep -q "KUBECONFIG" ~/.bashrc; then
        echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
    fi
    export KUBECONFIG=~/.kube/config

    log_info "Verifying k3s installation..."
    kubectl get nodes

    log_info "k3s installed successfully."
}

install_helm() {
    log_info "Installing Helm..."

    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

    if command -v helm &> /dev/null; then
        log_info "Helm installed: $(helm version --short)"
    fi
}


usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-k8s          Skip Kubernetes (k3s) installation"
    echo "  --skip-nitrorun    Skip NitroRun CLI installation"
    echo "  --deploy-nitrorun  Deploy NitroRun to Kubernetes after install"
    echo "  --all               Install everything and deploy NitroRun"
    echo "  -h, --help          Show this help message"
}

main() {
    echo "=============================================="
    echo "  Nitro Dev Environment Installation"
    echo "  Target: Ubuntu 24.04 LTS"
    echo "=============================================="
    echo ""

    check_sudo
    require_apt

    SKIP_K8S=false
    SKIP_NITRORUN=false
    DEPLOY_NITRORUN=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-k8s) SKIP_K8S=true; shift ;;
            --skip-nitrorun) SKIP_NITRORUN=true; shift ;;
            --deploy-nitrorun) DEPLOY_NITRORUN=true; shift ;;
            --all) DEPLOY_NITRORUN=true; shift ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    install_prerequisites
    install_nitro_tools

    if [ "$SKIP_NITRORUN" = false ]; then
        install_nitrorun
    else
        log_info "Skipping NitroRun CLI installation."
    fi

    if [ "$SKIP_K8S" = false ]; then
        install_k3s
        install_helm
    else
        log_info "Skipping Kubernetes installation."
    fi

    if [ "$DEPLOY_NITRORUN" = true ] && [ "$SKIP_K8S" = false ] && [ "$SKIP_NITRORUN" = false ]; then
        deploy_nitrorun
    fi

    echo ""
    echo "=============================================="
    echo "  Installation Complete!"
    echo "=============================================="
    echo ""

    log_info "Installed components:"
    echo "  - AWS Nitro Enclaves tooling"
    if [ "$SKIP_NITRORUN" = false ]; then
        echo "  - NitroRun CLI"
    fi
    if [ "$SKIP_K8S" = false ]; then
        echo "  - k3s (lightweight Kubernetes)"
        echo "  - Helm (Kubernetes package manager)"
    fi

    echo ""
    log_warn "IMPORTANT: Reload your shell or run: source ~/.bashrc"
    echo ""
    log_info "Next steps:"
    echo "  1. source ~/.bashrc"
    if [ "$SKIP_K8S" = false ]; then
        echo "  2. kubectl get nodes  # Verify Kubernetes"
    fi
    echo "  3. nitro-cli --help   # Verify Nitro CLI"
    if [ "$SKIP_NITRORUN" = false ]; then
        echo "  4. nitrorun --help   # Verify NitroRun CLI"
    fi
}

main "$@"
