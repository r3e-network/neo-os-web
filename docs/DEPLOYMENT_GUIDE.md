# Deployment Guide (Nitro-Only)

This guide documents the supported deployment path for this repository: **Nitro-oriented TEE services**.

## 1. Deployment Modes

Supported environments:

- `dev` -> `k8s/overlays/dev`
- `staging` -> `k8s/overlays/staging`
- `prod` -> `k8s/overlays/prod`

All environments inherit Nitro-oriented base configuration (`TEE_BACKEND=nitro`).

## 2. Build and Deploy with Script

Use the deployment script:

```bash
./scripts/deploy_k8s.sh --env dev
./scripts/deploy_k8s.sh --env staging
./scripts/deploy_k8s.sh --env prod
```

The script builds services with:

- `docker/Dockerfile.service.nitro`

Deprecated enclave-signing flags are ignored if provided.

## 3. Manual Manifest Rendering

Render overlays before apply:

```bash
kubectl kustomize k8s/base
kubectl kustomize k8s/overlays/nitro
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/staging
kubectl kustomize k8s/overlays/prod
```

Apply:

```bash
kubectl apply -k k8s/overlays/dev
kubectl apply -k k8s/overlays/staging
kubectl apply -k k8s/overlays/prod
```

## 4. Required Runtime Config

Core config:

- `TEE_BACKEND=nitro`
- `MARBLE_ENV` (`development`, `testing`, or `production`)
- `COORDINATOR_MESH_ADDR`
- `COORDINATOR_CLIENT_ADDR`

Secrets and service config come from Kubernetes secrets/configmaps and MarbleRun manifest parameters.

## 5. Nitro Attestation Inputs

Production-style runtime should provide:

- `NITRO_ATTESTATION_DOCUMENT_B64`
- `NITRO_MODULE_ID` (optional)
- `NITRO_PCR0..NITRO_PCR31` (optional)

Preflight validation:

```bash
./scripts/check_enclave_signing_key.sh --backend nitro
```

Production readiness check:

```bash
./scripts/production_readiness_check.sh
```

## 6. Local Pre-Deploy Validation

Run these checks before pushing images/manifests:

```bash
bash -n scripts/deploy_k8s.sh
bash -n scripts/docker_smoke.sh
go test ./infrastructure/runtime ./infrastructure/marble ./cmd/marble
./scripts/docker_smoke.sh
```

## 7. Rollout/Verification

After deployment:

```bash
kubectl -n service-layer get deploy
kubectl -n service-layer get pods
kubectl -n service-layer logs deploy/neocompute --tail=100
```

Validate that services receive Nitro backend config:

```bash
kubectl -n service-layer get configmap service-layer-config -o yaml | grep TEE_BACKEND
```

## 8. Rollback

Rollback to previous image tag:

1. Update image tag in the target overlay.
2. Re-apply the overlay:

```bash
kubectl apply -k k8s/overlays/prod
```

3. Confirm rollout state:

```bash
kubectl -n service-layer rollout status deployment/neocompute
```

## 9. Notes

- Legacy Open Enclave build and deployment paths are no longer supported in this repository.
- Keep Nitro attestation and strict identity settings consistent across environments.
