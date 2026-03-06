#!/bin/bash
#
# Service Layer Kubernetes Deployment Script
# Supports multiple environments: dev, test, staging, prod (Nitro-only)
# Features: Docker build, registry push, rolling updates, health checks
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Default configuration
ENVIRONMENT="dev"
REGISTRY=""
PUSH_TO_REGISTRY=false
SKIP_BUILD=false
SKIP_TESTS=false
ROLLING_UPDATE=false
WAIT_TIMEOUT=300
DRY_RUN=false
OVERLAY_PATH=""
FORCE_K3S_IMPORT="${FORCE_K3S_IMPORT:-false}"

# Services to build and deploy
SERVICES=(
    "neofeeds"
    "neoflow"
    "neoaccounts"
    "neocompute"
    "neovrf"
    "neooracle"
    "neorequests"
    "neogasbank"
    "neosimulation"
    "txproxy"
    "globalsigner"
)

# =============================================================================
# Parse Arguments
# =============================================================================
usage() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

Commands:
  build       Build all Docker images
  push        Push images to registry
  deploy      Deploy to Kubernetes
  update      Perform rolling update
  status      Show deployment status
  cleanup     Remove all deployments
  all         Build, push, and deploy (default)

Options:
  --env <env>           Environment: dev, test, staging, prod (default: dev)
  --overlay <path>      Override the kustomize overlay path (e.g. k8s/overlays/prod)
  --registry <url>      Docker registry URL (e.g., docker.io/myorg). Images will be pushed as: <registry>/service-layer/<service>:<tag>
  --push                Push images to registry after build
  --skip-build          Skip Docker image build
  --skip-tests          Skip running tests before deployment
  --rolling-update      Perform rolling update instead of recreate
  --timeout <seconds>   Wait timeout for deployments (default: 300)
  --dry-run             Show what would be done without executing
  -h, --help            Show this help message

Examples:
  # Deploy to development (local k3s)
  $0 --env dev

  # Build and push to registry for production
  $0 --env prod --registry docker.io/myorg --push

  # Perform rolling update in production
  $0 --env prod --rolling-update update

  # Deploy to test environment
  $0 --env test deploy

  # Deploy staging (Nitro)
  $0 --env staging deploy

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --overlay)
                OVERLAY_PATH="$2"
                shift 2
                ;;
            --registry)
                REGISTRY="$2"
                PUSH_TO_REGISTRY=true
                shift 2
                ;;
            --push)
                PUSH_TO_REGISTRY=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --rolling-update)
                ROLLING_UPDATE=true
                shift
                ;;
            --timeout)
                WAIT_TIMEOUT="$2"
                shift 2
                ;;
            --signing-key|--signing-key-dir|--skip-signer-check)
                log_warn "$1 is deprecated and ignored in Nitro-only mode."
                if [[ "$1" == "--signing-key" || "$1" == "--signing-key-dir" ]]; then
                    shift 2
                else
                    shift
                fi
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            build|push|deploy|update|status|cleanup|all)
                COMMAND="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Set default command
    COMMAND="${COMMAND:-all}"

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(dev|test|staging|prod)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT (must be dev, test, staging, or prod)"
        exit 1
    fi

    # Set registry prefix if provided
    if [ -n "$REGISTRY" ]; then
        IMAGE_PREFIX="$REGISTRY/service-layer/"
    else
        IMAGE_PREFIX="service-layer/"
    fi
}

# =============================================================================
# Helpers
# =============================================================================
default_service_binary() {
    # Some packages keep legacy binary names for compatibility.
    case "$1" in
        neoaccounts) echo "accountpool" ;;
        *) echo "$1" ;;
    esac
}

resolve_overlay_path() {
    if [[ -n "$OVERLAY_PATH" ]]; then
        echo "$OVERLAY_PATH"
        return 0
    fi
    case "$ENVIRONMENT" in
        dev) echo "k8s/overlays/dev" ;;
        test) echo "k8s/overlays/dev" ;;
        staging) echo "k8s/overlays/staging" ;;
        prod) echo "k8s/overlays/prod" ;;
        *) echo "k8s/overlays/dev" ;;
    esac
}

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
    local env_file="${2:-}"
    local value="${!key:-}"

    if [[ -n "$value" ]]; then
        printf '%s' "$value"
        return 0
    fi

    if value="$(read_env_file_var "$env_file" "$key")"; then
        printf '%s' "$value"
        return 0
    fi

    return 1
}

# =============================================================================
# Pre-flight Checks
# =============================================================================
preflight_checks() {
    log_step "Running pre-flight checks..."

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        log_error "docker not found. Please install Docker."
        exit 1
    fi

    # Check if k3s is running (for dev environment)
    if [ "$ENVIRONMENT" == "dev" ] && [ "$DRY_RUN" != "true" ]; then
        if ! kubectl get nodes &> /dev/null; then
            log_error "Kubernetes cluster not accessible. Is k3s running?"
            exit 1
        fi
    fi

    # NitroRun is optional in local dev. Keep warnings for non-dev deployments only.
    if ! command -v nitrorun &> /dev/null && [ "$ENVIRONMENT" != "dev" ]; then
        log_warn "nitrorun CLI not found. Production-style coordinator features may not work."
    fi

    # Check cert-manager ClusterIssuer email configuration
    local cert_issuer_file="$PROJECT_ROOT/k8s/platform/cert-manager/cluster-issuer.yaml"
    if [[ -f "$cert_issuer_file" ]]; then
        if grep -q "email:.*@example\.com" "$cert_issuer_file"; then
            log_error "cert-manager ClusterIssuer still contains the default example email (@example.com)"
            log_error "Please update the email addresses in: $cert_issuer_file"
            log_error "The email is required for Let's Encrypt ACME registration"
            exit 1
        fi
    fi

    log_info "Pre-flight checks passed"
}

# =============================================================================
# Run Tests
# =============================================================================
run_tests() {
    if [ "$SKIP_TESTS" == "true" ]; then
        log_info "Skipping tests (--skip-tests)"
        return 0
    fi

    log_step "Running tests..."

    cd "$PROJECT_ROOT"

    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would run: go test -v ./..."
        return 0
    fi

    local packages
    packages=$(go list ./... | grep -v '/scripts$' || true)
    if [[ -z "$packages" ]]; then
        log_error "No Go packages found to test."
        exit 1
    fi

    if ! go test -v $packages; then
        log_error "Tests failed. Aborting deployment."
        exit 1
    fi

    log_info "All tests passed"
}

# =============================================================================
# Build Docker Images
# =============================================================================
build_images() {
    if [ "$SKIP_BUILD" == "true" ]; then
        log_info "Skipping build (--skip-build)"
        return 0
    fi

    log_step "Building Docker images for environment: $ENVIRONMENT..."

    cd "$PROJECT_ROOT"

    for service in "${SERVICES[@]}"; do
        log_info "Building $service..."

        local image_name="${IMAGE_PREFIX}${service}:${ENVIRONMENT}"
        local dockerfile="docker/Dockerfile.service.nitro"

        if [ "$DRY_RUN" == "true" ]; then
            log_info "[DRY RUN] Would build: $image_name"
            continue
        fi

        local service_binary
        service_binary="$(default_service_binary "$service")"
        docker build -t "$image_name" \
            --build-arg SERVICE="$service_binary" \
            -f "$dockerfile" . || {
            log_error "Failed to build $service"
            exit 1
        }

        # Also tag as latest for the environment
        docker tag "$image_name" "${IMAGE_PREFIX}${service}:latest"

        log_info "$service image built successfully"
    done

    log_info "All images built successfully"
}

# =============================================================================
# Push Images to Registry
# =============================================================================
push_images() {
    if [ "$PUSH_TO_REGISTRY" != "true" ]; then
        log_info "Skipping registry push (use --push to enable)"
        return 0
    fi

    if [ -z "$REGISTRY" ]; then
        log_error "Registry not specified. Use --registry <url>"
        exit 1
    fi

    log_step "Pushing images to registry: $REGISTRY..."

    for service in "${SERVICES[@]}"; do
        local image_name="${IMAGE_PREFIX}${service}:${ENVIRONMENT}"

        log_info "Pushing $image_name..."

        if [ "$DRY_RUN" == "true" ]; then
            log_info "[DRY RUN] Would push: $image_name"
            continue
        fi

        docker push "$image_name" || {
            log_error "Failed to push $service"
            exit 1
        }

        log_info "$service pushed successfully"
    done

    log_info "All images pushed successfully"
}

# =============================================================================
# Import Images to k3s (for local development)
# =============================================================================
import_images_k3s() {
    if [[ "$ENVIRONMENT" != "dev" && "$FORCE_K3S_IMPORT" != "true" ]]; then
        log_info "Skipping k3s import (not dev environment)"
        return 0
    fi

    if [ "$PUSH_TO_REGISTRY" == "true" ]; then
        log_info "Skipping k3s import (using registry)"
        return 0
    fi

    log_step "Importing images to k3s..."

    local sudo_cmd=(sudo)
    if [[ -n "${ROOT_PASSWORD:-}" ]]; then
        echo "$ROOT_PASSWORD" | sudo -S -v >/dev/null
        sudo_cmd=(sudo -n)
    fi

    for service in "${SERVICES[@]}"; do
        local image_name="${IMAGE_PREFIX}${service}:${ENVIRONMENT}"

        log_info "Importing $service to k3s..."

        if [ "$DRY_RUN" == "true" ]; then
            log_info "[DRY RUN] Would import: $image_name"
            continue
        fi

        docker save "$image_name" | "${sudo_cmd[@]}" k3s ctr images import - || {
            log_warn "Failed to import $service to k3s"
        }
    done

    log_info "All images imported to k3s"
}

# =============================================================================
# Setup NitroRun Manifest
# =============================================================================
setup_nitrorun_manifest() {
    log_step "Setting up coordinator manifest (optional)..."

    # Check if NitroRun is ready
    if ! command -v nitrorun &> /dev/null; then
        log_info "Coordinator CLI not found, skipping optional manifest setup"
        return 0
    fi

    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would setup NitroRun manifest"
        return 0
    fi

    # Check if NitroRun is installed in cluster
    if ! kubectl get namespace nitrorun &> /dev/null; then
        log_info "Coordinator not installed in cluster, skipping optional manifest setup"
        return 0
    fi

    # Port forward to coordinator
    log_info "Setting up port forwarding to coordinator..."
    local coordinator_svc="coordinator-client-api"
    if ! kubectl -n nitrorun get svc "$coordinator_svc" &>/dev/null; then
        coordinator_svc="nitrorun-coordinator-client-api"
    fi
    if ! kubectl -n nitrorun get svc "$coordinator_svc" &>/dev/null; then
        log_info "Coordinator client service not found; skipping optional manifest setup."
        return 0
    fi

    kubectl -n nitrorun port-forward "svc/${coordinator_svc}" 4433:4433 &
    PF_PID=$!
    sleep 3

    # Set the manifest
    log_info "Setting NitroRun manifest..."
    local flags=()
    local manifest_file="$PROJECT_ROOT/manifests/manifest.json"
    local tmp_manifest=""
    local env_file="$PROJECT_ROOT/.env"
    local supabase_url
    local supabase_service_key
    local globalsigner_master_seed
    local tee_private_key
    local secrets_master_key
    local pool_master_key
    local pool_encryption_key
    local compute_master_key
    local neofeeds_signing_key
    local neovrf_signing_key

    supabase_url="$(resolve_runtime_var SUPABASE_URL "$env_file" || true)"
    supabase_service_key="$(resolve_runtime_var SUPABASE_SERVICE_KEY "$env_file" || true)"
    globalsigner_master_seed="$(resolve_runtime_var GLOBALSIGNER_MASTER_SEED "$env_file" || true)"
    tee_private_key="$(resolve_runtime_var TEE_PRIVATE_KEY "$env_file" || true)"
    secrets_master_key="$(resolve_runtime_var SECRETS_MASTER_KEY "$env_file" || true)"
    pool_master_key="$(resolve_runtime_var POOL_MASTER_KEY "$env_file" || true)"
    pool_encryption_key="$(resolve_runtime_var POOL_ENCRYPTION_KEY "$env_file" || true)"
    compute_master_key="$(resolve_runtime_var COMPUTE_MASTER_KEY "$env_file" || true)"
    neofeeds_signing_key="$(resolve_runtime_var NEOFEEDS_SIGNING_KEY "$env_file" || true)"
    neovrf_signing_key="$(resolve_runtime_var NEOVRF_SIGNING_KEY "$env_file" || true)"
    if [[ -z "$supabase_url" || -z "$supabase_service_key" ]]; then
        log_error "SUPABASE_URL and SUPABASE_SERVICE_KEY are required for NitroRun services."
        log_error "Export them in the shell or set them in ${env_file} before deployment."
        return 1
    fi
    if [[ -z "$globalsigner_master_seed" ]]; then
        log_error "GLOBALSIGNER_MASTER_SEED is required for deterministic GlobalSigner signatures."
        log_error "Export it in the shell or set it in ${env_file} before deployment."
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq not found; required to inject runtime SUPABASE_* values into the NitroRun manifest."
        return 1
    fi

    tmp_manifest="$(mktemp -t service-layer-manifest.runtime.XXXXXX.json)"
    if [[ ! "$ENVIRONMENT" =~ ^(prod|staging)$ ]]; then
        flags+=(--insecure)
        jq \
            --arg supabase_url "$supabase_url" \
            --arg supabase_service_key "$supabase_service_key" \
            --arg globalsigner_master_seed "$globalsigner_master_seed" \
            --arg tee_private_key "$tee_private_key" \
            --arg secrets_master_key "$secrets_master_key" \
            --arg pool_master_key "$pool_master_key" \
            --arg pool_encryption_key "$pool_encryption_key" \
            --arg compute_master_key "$compute_master_key" \
            --arg neofeeds_signing_key "$neofeeds_signing_key" \
            --arg neovrf_signing_key "$neovrf_signing_key" \
            '
            .Nitros |= with_entries(
                .value.Parameters.Env.SUPABASE_URL = $supabase_url
                | .value.Parameters.Env.SUPABASE_SERVICE_KEY = $supabase_service_key
                | .value.Parameters.Env |= (
                    if has("GLOBALSIGNER_MASTER_SEED") then .GLOBALSIGNER_MASTER_SEED = $globalsigner_master_seed else . end
                    | if $tee_private_key != "" and has("TEE_PRIVATE_KEY") then .TEE_PRIVATE_KEY = $tee_private_key else . end
                    | if $secrets_master_key != "" and has("SECRETS_MASTER_KEY") then .SECRETS_MASTER_KEY = $secrets_master_key else . end
                    | if $pool_master_key != "" and has("POOL_MASTER_KEY") then .POOL_MASTER_KEY = $pool_master_key else . end
                    | if $pool_encryption_key != "" and has("POOL_ENCRYPTION_KEY") then .POOL_ENCRYPTION_KEY = $pool_encryption_key else . end
                    | if $compute_master_key != "" and has("COMPUTE_MASTER_KEY") then .COMPUTE_MASTER_KEY = $compute_master_key else . end
                    | if $neofeeds_signing_key != "" and has("NEOFEEDS_SIGNING_KEY") then .NEOFEEDS_SIGNING_KEY = $neofeeds_signing_key else . end
                    | if $neovrf_signing_key != "" and has("NEOVRF_SIGNING_KEY") then .NEOVRF_SIGNING_KEY = $neovrf_signing_key else . end
                  )
              )
            ' \
            "$manifest_file" > "$tmp_manifest"
    else
        jq \
            --arg supabase_url "$supabase_url" \
            --arg supabase_service_key "$supabase_service_key" \
            --arg globalsigner_master_seed "$globalsigner_master_seed" \
            --arg tee_private_key "$tee_private_key" \
            --arg secrets_master_key "$secrets_master_key" \
            --arg pool_master_key "$pool_master_key" \
            --arg pool_encryption_key "$pool_encryption_key" \
            --arg compute_master_key "$compute_master_key" \
            --arg neofeeds_signing_key "$neofeeds_signing_key" \
            --arg neovrf_signing_key "$neovrf_signing_key" \
            '
            .Nitros |= with_entries(
                .value.Parameters.Env.SUPABASE_URL = $supabase_url
                | .value.Parameters.Env.SUPABASE_SERVICE_KEY = $supabase_service_key
                | .value.Parameters.Env |= (
                    if has("GLOBALSIGNER_MASTER_SEED") then .GLOBALSIGNER_MASTER_SEED = $globalsigner_master_seed else . end
                    | if $tee_private_key != "" and has("TEE_PRIVATE_KEY") then .TEE_PRIVATE_KEY = $tee_private_key else . end
                    | if $secrets_master_key != "" and has("SECRETS_MASTER_KEY") then .SECRETS_MASTER_KEY = $secrets_master_key else . end
                    | if $pool_master_key != "" and has("POOL_MASTER_KEY") then .POOL_MASTER_KEY = $pool_master_key else . end
                    | if $pool_encryption_key != "" and has("POOL_ENCRYPTION_KEY") then .POOL_ENCRYPTION_KEY = $pool_encryption_key else . end
                    | if $compute_master_key != "" and has("COMPUTE_MASTER_KEY") then .COMPUTE_MASTER_KEY = $compute_master_key else . end
                    | if $neofeeds_signing_key != "" and has("NEOFEEDS_SIGNING_KEY") then .NEOFEEDS_SIGNING_KEY = $neofeeds_signing_key else . end
                    | if $neovrf_signing_key != "" and has("NEOVRF_SIGNING_KEY") then .NEOVRF_SIGNING_KEY = $neovrf_signing_key else . end
                  )
              )
            ' \
            "$manifest_file" > "$tmp_manifest"
    fi
    manifest_file="$tmp_manifest"

    if ! nitrorun manifest set "$manifest_file" "localhost:4433" "${flags[@]}"; then
        log_warn "Manifest set failed; attempting manifest update"
        if nitrorun manifest update apply --help >/dev/null 2>&1; then
            if ! nitrorun manifest update apply "$manifest_file" "localhost:4433" "${flags[@]}"; then
                log_warn "Manifest update failed; coordinator may not be ready"
            fi
        else
            log_warn "nitrorun manifest update not available; skipping"
        fi
    fi
    if [[ -n "$tmp_manifest" ]]; then
        rm -f "$tmp_manifest"
    fi

    # Kill port forward
    kill $PF_PID 2>/dev/null || true

    log_info "NitroRun manifest configured"
}

# =============================================================================
# Deploy to Kubernetes
# =============================================================================
deploy_k8s() {
    log_step "Deploying to Kubernetes (environment: $ENVIRONMENT)..."

    cd "$PROJECT_ROOT"

    local overlay_path
    overlay_path="$(resolve_overlay_path)"
    if [ ! -d "$overlay_path" ]; then
        log_error "Overlay not found: $overlay_path"
        exit 1
    fi

    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would apply: $overlay_path"
        log_info "[DRY RUN] Would set images to: ${IMAGE_PREFIX}<service>:${ENVIRONMENT}"
        if [ "$ENVIRONMENT" == "dev" ]; then
            log_info "[DRY RUN] Would recreate existing service-layer deployments to avoid immutable selector drift"
        fi
        return 0
    fi

    if [ "$ENVIRONMENT" == "dev" ]; then
        local existing_deployments
        existing_deployments="$(kubectl -n service-layer get deployment -o name 2>/dev/null || true)"
        if [[ -n "$existing_deployments" ]]; then
            log_info "Recreating existing service-layer deployments for local dev..."
            kubectl -n service-layer delete deployment --all --ignore-not-found=true || {
                log_error "Failed to delete existing service-layer deployments"
                exit 1
            }

            local wait_deadline=$((SECONDS + WAIT_TIMEOUT))
            while kubectl -n service-layer get deployment -o name 2>/dev/null | grep -q .; do
                if (( SECONDS >= wait_deadline )); then
                    log_error "Timed out waiting for existing service-layer deployments to be deleted"
                    exit 1
                fi
                sleep 2
            done
        fi
    fi

    # Apply Kubernetes manifests with image overrides to match the environment tag.
    local sed_expr=(
        -e "s#(^[[:space:]]*image:[[:space:]]*)service-layer/#\\1${IMAGE_PREFIX}#"
        -e "s#(^[[:space:]]*image:[[:space:]].*):[^[:space:]]+#\\1:${ENVIRONMENT}#"
    )

    # When deploying local images (no registry prefix), avoid forced remote pulls.
    if [[ "$IMAGE_PREFIX" == "service-layer/" || "$FORCE_K3S_IMPORT" == "true" ]]; then
        sed_expr+=(-e "s#(^[[:space:]]*imagePullPolicy:[[:space:]]*)Always#\\1IfNotPresent#")
    fi

    log_info "Applying Kubernetes manifests from $overlay_path..."
    kubectl kustomize "$overlay_path" | \
        sed -E "${sed_expr[@]}" | \
        kubectl apply -f - || {
            log_error "Failed to apply Kubernetes manifests"
            exit 1
        }

    # Wait for deployments
    log_info "Waiting for deployments to be ready (timeout: ${WAIT_TIMEOUT}s)..."
    kubectl -n service-layer wait --for=condition=available \
        --timeout="${WAIT_TIMEOUT}s" deployment --all || {
        log_warn "Some deployments may not be ready yet"
        kubectl -n service-layer get pods
        return 1
    }

    log_info "Deployment complete"
}

# =============================================================================
# Rolling Update
# =============================================================================
rolling_update() {
    log_step "Performing rolling update..."

    cd "$PROJECT_ROOT"

    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would perform rolling update"
        return 0
    fi

    for service in "${SERVICES[@]}"; do
        log_info "Updating $service..."

        # Restart deployment to trigger rolling update
        kubectl -n service-layer rollout restart deployment "$service" || {
            log_warn "Failed to restart $service deployment"
            continue
        }

        # Wait for rollout to complete
        kubectl -n service-layer rollout status deployment "$service" --timeout="${WAIT_TIMEOUT}s" || {
            log_error "Rolling update failed for $service"
            exit 1
        }

        log_info "$service updated successfully"
    done

    log_info "Rolling update complete"
}

# =============================================================================
# Show Status
# =============================================================================
show_status() {
    log_step "Deployment Status (environment: $ENVIRONMENT)"

    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Skipping live cluster status checks"
        return 0
    fi

    echo ""
    echo "=== Kubernetes Nodes ==="
    kubectl get nodes

    echo ""
    echo "=== NitroRun Status ==="
    kubectl -n nitrorun get pods 2>/dev/null || echo "NitroRun not installed"

    echo ""
    echo "=== Service Layer Pods ==="
    kubectl -n service-layer get pods

    echo ""
    echo "=== Service Layer Services ==="
    kubectl -n service-layer get svc

    echo ""
    echo "=== Service Layer Deployments ==="
    kubectl -n service-layer get deployments

    echo ""
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        log_info "Public gateway is Supabase Edge (outside this cluster)."
        log_info "To debug internal services, port-forward individual services, e.g.:"
        log_info "  kubectl -n service-layer port-forward svc/neofeeds 8083:8083"
    else
        log_info "Public gateway is Supabase Edge (outside this cluster)."
        log_info "To debug internal services, port-forward individual services, e.g.:"
        log_info "  kubectl -n service-layer port-forward svc/neofeeds 8083:8083"
    fi
}

# =============================================================================
# Cleanup
# =============================================================================
cleanup() {
    log_step "Cleaning up..."

    if [ "$DRY_RUN" == "true" ]; then
        log_info "[DRY RUN] Would delete namespace: service-layer"
        return 0
    fi

    kubectl delete namespace service-layer --ignore-not-found=true

    log_info "Cleanup complete"
}

# =============================================================================
# Main Execution
# =============================================================================
main() {
    export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"

    parse_args "$@"

    echo "=============================================="
    echo "  Service Layer Kubernetes Deployment"
    echo "  Environment: $ENVIRONMENT"
    echo "  Command: $COMMAND"
    if [ "$DRY_RUN" == "true" ]; then
        echo "  Mode: DRY RUN"
    fi
    echo "=============================================="
    echo ""

    case "$COMMAND" in
        build)
            preflight_checks
            run_tests
            build_images
            ;;
        push)
            preflight_checks
            push_images
            ;;
        deploy)
            preflight_checks
            import_images_k3s
            setup_nitrorun_manifest
            deploy_k8s
            show_status
            ;;
        update)
            preflight_checks
            rolling_update
            show_status
            ;;
        status)
            show_status
            ;;
        cleanup)
            cleanup
            ;;
        all)
            preflight_checks
            run_tests
            build_images
            push_images
            import_images_k3s
            setup_nitrorun_manifest
            deploy_k8s
            show_status
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            usage
            exit 1
            ;;
    esac

    echo ""
    log_info "Operation completed successfully"
}

main "$@"
