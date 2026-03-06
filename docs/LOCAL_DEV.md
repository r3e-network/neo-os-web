# Local Development Setup

Complete guide for setting up the local k3s development environment for the Neo Service Layer platform.

## Overview

The local development stack provides a complete Kubernetes environment running on your machine with:

- **k3s**: Lightweight Kubernetes distribution
- **Kubernetes-native local mesh**: service-to-service HTTP for local Nitro-oriented workflows on any CPU architecture
- **Traefik**: Ingress controller with TLS
- **cert-manager**: Automatic TLS certificate management
- **Self-signed certificates**: For `*.localhost` domains
- **Supabase**: Local Postgres + Auth + PostgREST

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended) or macOS
- **CPU**: 4+ cores (8+ recommended)
- **Memory**: 8GB+ RAM (16GB+ recommended)
- **Disk**: 20GB+ free space
- **Architecture**: x86_64 or ARM64

### Required Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Docker (for building images)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Go 1.21+ (for building services)
# Download the archive that matches your CPU architecture from https://go.dev/dl/

```

## Quick Start

### One-Command Bootstrap (k3s + Supabase + Services + Edge)

```bash
./scripts/bootstrap_k3s_dev.sh --env-file .env --edge-env-file .env.local
```

Or use the Make target:

```bash
make dev-stack-bootstrap
```

Ensure `.env` contains contract hashes and `.env.local` contains Supabase keys
before running the bootstrap script.

### 1. Bootstrap k3s Local Stack

Run the automated setup script:

```bash
# Install complete k3s dev stack
./scripts/k3s-local-setup.sh install

# Or use Make target
make dev-stack-up
```

This will:

1. Install k3s with Traefik ingress
2. Create all required namespaces
3. Install cert-manager
4. Set up self-signed TLS certificates
5. Enable Kubernetes-native local mesh mode (no external coordinator)

### 2. Verify Installation

```bash
# Check status
./scripts/k3s-local-setup.sh status

# Or use Make target
make dev-stack-status

# View all pods
kubectl get pods -A
```

Expected output:

```
✓ k3s: Running
✓ cert-manager: Installed
✓ Local mesh mode: Kubernetes-native (no NitroRun coordinator)
✓ Traefik: Running
```

### 3. Deploy Services

```bash
# Build and deploy all services
make docker-build
make docker-up

# Or deploy to k3s
./scripts/deploy_k8s.sh --env dev
```

## Architecture

### Namespaces

The local stack creates the following namespaces:

- `cert-manager`: TLS for ingress and optional local certificates
- `service-layer`: Core services (neoaccounts, neofeeds, etc.)
- `supabase`: Database and auth services (local dev)
- `platform`: Edge gateway and admin console (DEVSTACK-3/4)
- `cert-manager`: Certificate management
- `kube-system`: k3s system components

### Network Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Traefik Ingress                          │
│              (*.localhost with self-signed TLS)             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌─────────▼────────┐  ┌────────▼────────┐
│ Kubernetes     │  │  Service Layer   │  │    Supabase     │
│ local network   │  │    Services      │  │   (local)       │
│ (Cluster DNS)   │  │                  │  │                 │
│ service-layer   │  │ neoaccounts:8085 │  │ postgres:5432   │
│ platform        │  │ neofeeds:8083    │  │ postgrest:3000  │
└────────────────┘  │ neoflow:8084     │  └─────────────────┘
                    │ neogasbank:8091  │
                    │ neosimulation:8093 │
                    │ ...              │
                    └──────────────────┘
```

### Service URLs (Local)

All services are accessible via `*.localhost` domains:

- **Service Layer APIs**: access via `kubectl port-forward` or in-cluster DNS
- **Services**: Port-forward individual services as needed
- **Supabase** (local): `https://supabase.localhost`
- **Admin Console** (future): `https://admin.localhost`

## Common Operations

### Start/Stop Dev Stack

```bash
# Start everything
make dev-stack-up

# Stop everything
make dev-stack-down

# Check status
make dev-stack-status
```

### Access Service Layer APIs

```bash
# Port forward a service for debugging
kubectl -n service-layer port-forward svc/neofeeds 8083:8083

# Health check
curl http://localhost:8083/health
```

The local k3s flow uses a Kubernetes-native HTTP mesh by default.
Production-style mTLS is optional and can be layered on later if needed.

### Local Supabase

```bash
# Deploy Supabase into k3s
./scripts/supabase-k3s.sh deploy

# Apply secrets from .env.local (Supabase URL/keys included)
./scripts/apply_k8s_secrets_from_env.sh --env-file .env.local

# Sync non-secret config (contract hashes, RPC, allowlists) into k3s ConfigMap
./scripts/apply_k8s_config_from_env.sh --env-file .env
```

Local Supabase credentials are stored in `.env.local` (and generated into
`.env.supabase` when first bootstrapped). Contract hashes and service endpoints
are also loaded from `.env` / `config/*.env` for consistency across dev and
testnet.

`apply_k8s_config_from_env.sh` patches the `service-layer-config` ConfigMap with
non-secret values from `.env` (contract hashes, RPC URL, allowlists), keeping
k3s aligned with your local configuration.

For k3s local dev, the service-layer nitros typically use:

- `SUPABASE_URL=http://postgrest.supabase.svc.cluster.local:3000`
- `SUPABASE_REST_PREFIX=/` (no `/rest/v1` prefix for direct PostgREST)
- `SUPABASE_ALLOW_INSECURE=true`

For the **Edge gateway** (Supabase functions), use the internal gateway service:

- `SUPABASE_URL=http://supabase-gateway.supabase.svc.cluster.local:8000`

### Edge Gateway (Supabase Functions)

The Edge gateway runs the Deno-based Supabase functions inside k3s.
In local dev it uses Deno's `--unsafely-ignore-certificate-errors` to allow
self-signed mTLS endpoints.
Because the mTLS client uses Deno's experimental `HttpClient` API, the Edge
runtime must run with `--unstable` (already enabled in the k3s deployment and
`deno task dev`).

```bash
# Build the edge gateway image
docker build -f platform/edge/k8s.dockerfile -t service-layer/edge-gateway:latest platform/edge

# Import into k3s (uses sudo)
docker save service-layer/edge-gateway:latest | sudo k3s ctr images import -

# Apply Edge secrets from .env.local
./scripts/apply_edge_secrets_from_env.sh --env-file .env.local

# Deploy Edge gateway
kubectl apply -k k8s/platform/edge
```

For browser access, map the node IP to `edge.localhost` in `/etc/hosts`:

```
<node-ip> edge.localhost
```

### Edge ↔ Service Layer Connectivity

The default local k3s flow uses **plain HTTP** inside the cluster so it works on
aarch64 hosts without NitroRun. The Edge gateway talks to service-layer pods via
`http://*.service-layer.svc.cluster.local` in development mode.

If you later add your own internal PKI, you can still use `./scripts/setup_edge_mtls.sh`
as a separate hardening step.

### Access Services

```bash
# Port forward to a service
kubectl -n service-layer port-forward svc/neoaccounts 8085:8085

# Test the service
curl http://localhost:8085/health
```

### View Logs

```bash
# All pods in namespace
kubectl -n service-layer logs -f --all-containers=true -l app=neoaccounts

# Specific pod
kubectl -n service-layer logs -f <pod-name>

```

### Rebuild and Redeploy

```bash
# Rebuild images
make docker-build

# Import to k3s
for service in neoaccounts neofeeds neoflow; do
  docker save service-layer/$service:dev | sudo k3s ctr images import -
done

# Restart deployments
kubectl -n service-layer rollout restart deployment
```

## End-to-End Validation (Testnet)

Once the local stack is running, validate the on-chain request/callback path on
testnet using the runbook in `docs/WORKFLOWS.md` ("Testnet Callback Validation").
This ensures NeoRequests, TxProxy, and the TEE services are wired correctly.

## Troubleshooting

### k3s Won't Start

```bash
# Check k3s service
sudo systemctl status k3s

# View k3s logs
sudo journalctl -u k3s -f

# Restart k3s
sudo systemctl restart k3s
```

### Pods Stuck in Pending

```bash
# Check pod events
kubectl -n service-layer describe pod <pod-name>

# Check node resources
kubectl describe nodes

# Check PVC status
kubectl get pvc -A
```

### Certificate Issues

```bash
# Check certificate status
kubectl -n cert-manager get certificates

# Describe certificate
kubectl -n cert-manager describe certificate wildcard-localhost

# Check cert-manager logs
kubectl -n cert-manager logs -f deployment/cert-manager
```

### Local Mesh Not Reaching Services

```bash
# Check service pods
kubectl -n service-layer get pods

# Inspect a representative service
kubectl -n service-layer logs -f deployment/neofeeds

# Inspect the edge gateway
kubectl -n platform logs -f deployment/edge-gateway
```

### Clean Slate Reset

```bash
# Complete cleanup
make dev-stack-down
./scripts/k3s-local-setup.sh cleanup

# Reinstall
./scripts/k3s-local-setup.sh install
```

## Configuration

### Environment Variables

```bash
# k3s version
export K3S_VERSION=v1.28.5+k3s1

# cert-manager version
export CERT_MANAGER_VERSION=v1.14.0

# Installation timeout
export INSTALL_TIMEOUT=300
```

### Customization

Edit the following files to customize your setup:

- `k8s/base/namespace.yaml`, `k8s/supabase/base/namespace.yaml`, `k8s/platform/*/namespace.yaml`: Add/modify namespaces
- `k8s/ingress/wildcard-cert.yaml`: Add more DNS names
- `scripts/k3s-local-setup.sh`: Adjust NitroRun installation and bootstrap steps
- `scripts/bootstrap_k3s_dev.sh`: Modify full-stack bootstrap sequencing

## Development Workflow

### Typical Development Cycle

1. **Start dev stack**

    ```bash
    make dev-stack-up
    ```

2. **Make code changes**

    ```bash
    # Edit Go code in services/
    vim services/neoaccounts/service.go
    ```

3. **Run tests**

    ```bash
    make test
    ```

4. **Rebuild and deploy**

    ```bash
    make docker-build
    ./scripts/deploy_k8s.sh --env dev
    ```

5. **Test changes**

    ```bash
    kubectl -n service-layer port-forward svc/neoaccounts 8085:8085
    curl http://localhost:8085/health
    ```

6. **View logs**
    ```bash
    kubectl -n service-layer logs -f deployment/neoaccounts
    ```

### Hot Reload (Future)

For faster iteration, consider using:

- **Skaffold**: Automatic rebuild and redeploy on file changes
- **Tilt**: Visual dev environment with live updates
- **Telepresence**: Local development with remote cluster

## Next Steps

After setting up the local dev stack:

1. **DEVSTACK-2**: Set up self-hosted Supabase
    - Continue with `./scripts/bootstrap_k3s_dev.sh --env-file .env --edge-env-file .env.local`

2. **DEVSTACK-3**: Deploy Edge gateway
    - Configure service mesh and routing

3. **DEVSTACK-4**: Set up Admin Console
    - Monitor services and test MiniApps

## Resources

- [k3s Documentation](https://docs.k3s.io/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review logs: `kubectl logs -n <namespace> <pod-name>`
3. Check cluster events: `kubectl get events -A --sort-by='.lastTimestamp'`
4. Continue with `scripts/bootstrap_k3s_dev.sh` and `docs/WORKFLOWS.md` for end-to-end setup and validation
