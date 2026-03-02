# Development Guide (Nitro-Only)

This repository now supports a single TEE orientation: **AWS Nitro**.

All local, CI, and Kubernetes workflows should use Nitro-compatible scripts and manifests.

## 1. Prerequisites

- Go 1.24+
- Docker + Docker Compose
- `kubectl` (for Kubernetes workflows)
- Optional: `marblerun` CLI

Install local tooling:

```bash
./scripts/install_dev_env.sh --skip-k8s
```

## 2. Environment Setup

Create your local environment file:

```bash
cp .env.example .env
```

Set at least:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `NEO_RPC_URL`
- `NEO_NETWORK_MAGIC`

Runtime backend defaults to Nitro:

```bash
TEE_BACKEND=nitro
```

## 3. Local Stack (Docker)

Start local stack:

```bash
./scripts/up.sh
```

Start without rebuilding images:

```bash
./scripts/up.sh --no-build
```

Stop stack:

```bash
make docker-down
```

Check logs:

```bash
make docker-logs
```

## 4. Smoke Test

Run end-to-end smoke test:

```bash
./scripts/docker_smoke.sh
```

Rebuild images before smoke test:

```bash
./scripts/docker_smoke.sh --build
```

## 5. Run Services Directly

Run a single service through the shared marble entrypoint:

```bash
TEE_BACKEND=nitro SERVICE_TYPE=neocompute go run ./cmd/marble
TEE_BACKEND=nitro SERVICE_TYPE=neovrf go run ./cmd/marble
TEE_BACKEND=nitro SERVICE_TYPE=neooracle go run ./cmd/marble
```

## 6. Tests

Run all tests:

```bash
make test
```

Run targeted packages:

```bash
go test ./infrastructure/runtime ./infrastructure/marble ./cmd/marble
```

Run lint:

```bash
make lint
```

## 7. Kubernetes Dev Flow

Render Nitro dev manifests:

```bash
kubectl kustomize k8s/overlays/dev
```

Deploy:

```bash
./scripts/deploy_k8s.sh --env dev
```

## 8. Security/Strict Mode

Strict identity mode is enabled by:

- `MARBLE_ENV=production`, or
- `STRICT_IDENTITY_MODE=true`, or
- MarbleRun TLS material (`MARBLE_CERT`, `MARBLE_KEY`, `MARBLE_ROOT_CA`), or
- `STRICT_IDENTITY_ON_TEE=true` while `TEE_BACKEND=nitro`

Nitro attestation input variables:

- `NITRO_ATTESTATION_DOCUMENT_B64`
- `NITRO_MODULE_ID` (optional)
- `NITRO_PCR0..NITRO_PCR31` (optional)

Validate Nitro attestation env setup:

```bash
./scripts/check_enclave_signing_key.sh --backend nitro
```

## 9. Troubleshooting

If services fail to start locally:

1. Ensure `.env` exists and has valid Supabase + Neo RPC values.
2. Rebuild images: `./scripts/up.sh` (without `--no-build`).
3. Inspect failing service logs: `docker compose -f docker/docker-compose.simulation.yaml -f docker/docker-compose.nitro.yaml logs <service>`.
4. Re-run smoke test: `./scripts/docker_smoke.sh`.

If strict mode fails in production-style environments:

1. Validate attestation env: `./scripts/check_enclave_signing_key.sh --backend nitro`.
2. Verify MarbleRun TLS env injection.
3. Confirm `TEE_BACKEND=nitro` in pod/service env.
