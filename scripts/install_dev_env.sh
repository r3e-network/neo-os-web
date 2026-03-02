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

install_marblerun() {
    log_info "Installing MarbleRun CLI..."

    curl -fsSL https://github.com/edgelesssys/marblerun/releases/latest/download/marblerun-linux-amd64 \
        -o /tmp/marblerun

    chmod +x /tmp/marblerun
    sudo mv /tmp/marblerun /usr/local/bin/marblerun

    if command -v marblerun &> /dev/null; then
        log_info "MarbleRun CLI installed: $(marblerun version 2>/dev/null || echo 'installed')"
    else
        log_error "MarbleRun CLI installation failed"
        return 1
    fi
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

deploy_marblerun() {
    log_info "Deploying MarbleRun to Kubernetes..."
    marblerun install --simulation

    log_info "Waiting for MarbleRun components..."
    marblerun check --timeout 120s || {
        log_warn "MarbleRun check timed out, checking pod status..."
        kubectl get pods -n marblerun
    }
}

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-k8s          Skip Kubernetes (k3s) installation"
    echo "  --skip-marblerun    Skip MarbleRun CLI installation"
    echo "  --deploy-marblerun  Deploy MarbleRun to Kubernetes after install"
    echo "  --all               Install everything and deploy MarbleRun"
    echo "  -h, --help          Show this help message"
}

main() {
    echo "=============================================="
    echo "  Nitro Dev Environment Installation"
    echo "  Target: Ubuntu 24.04 LTS"
    echo "=============================================="
    echo ""

    check_sudo

    SKIP_K8S=false
    SKIP_MARBLERUN=false
    DEPLOY_MARBLERUN=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-k8s) SKIP_K8S=true; shift ;;
            --skip-marblerun) SKIP_MARBLERUN=true; shift ;;
            --deploy-marblerun) DEPLOY_MARBLERUN=true; shift ;;
            --all) DEPLOY_MARBLERUN=true; shift ;;
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

    if [ "$SKIP_MARBLERUN" = false ]; then
        install_marblerun
    else
        log_info "Skipping MarbleRun CLI installation."
    fi

    if [ "$SKIP_K8S" = false ]; then
        install_k3s
        install_helm
    else
        log_info "Skipping Kubernetes installation."
    fi

    if [ "$DEPLOY_MARBLERUN" = true ] && [ "$SKIP_K8S" = false ] && [ "$SKIP_MARBLERUN" = false ]; then
        deploy_marblerun
    fi

    echo ""
    echo "=============================================="
    echo "  Installation Complete!"
    echo "=============================================="
    echo ""

    log_info "Installed components:"
    echo "  - AWS Nitro Enclaves tooling"
    if [ "$SKIP_MARBLERUN" = false ]; then
        echo "  - MarbleRun CLI"
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
    if [ "$SKIP_MARBLERUN" = false ]; then
        echo "  4. marblerun --help   # Verify MarbleRun CLI"
    fi
}

main "$@"
