# Neo N3 Service Layer

![Service Layer logo](docs/assets/service-layer-logo.svg)

[![Build Status](https://github.com/R3E-Network/service_layer/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/R3E-Network/service_layer/actions/workflows/ci-cd.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/R3E-Network/service_layer)](https://goreportcard.com/report/github.com/R3E-Network/service_layer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The Service Layer provides a lightweight orchestration runtime for Neo N3. It
wraps account management, function execution, automation, and gas-bank utilities
behind a simple HTTP API. It now targets a self-hosted Supabase Postgres backend
for all persistence (no in-memory mode in normal runs).

## Requirements

- Go 1.24+ (matching the toolchain declared in `go.mod`)
- Node.js 20+ / npm 10+ for building the dashboard and Devpack examples (repo includes `.nvmrc` set to 20 for `nvm use`)
- Supabase Postgres (self-hosted) for persistence (required; no in-memory fallback). See `docs/supabase-setup.md` for the bundled compose profile (Postgres + GoTrue/PostgREST/Kong/Studio).

## Current Capabilities

- Account registry backed by Supabase Postgres
- Function catalogue and executor with trigger, automation, oracle, price-feed,
  data-feed, data-stream, DataLink, randomness, and gas-bank integrations
- Devpack runtime with declarative action queueing and SDKs for authoring
  functions locally (TypeScript, plus matching helpers in Go/Rust/Python)
- Secret vault with optional encryption and runtime resolution for function
  execution
- Cryptographically secure random number generation per account
- Workspace wallets gate data feeds and DataLink channels; signer sets are enforced per account.
- Modular service manager that wires the domain services together
- Optional RocketMQ-backed event bus (`svc-rocketmq`) as an infra module
- HTTP API located in `internal/app/httpapi`, exposing the new surface under
  `/accounts/...`
- Auditing: persisted to Supabase Postgres (plus optional JSONL via `AUDIT_LOG_PATH`) and an admin-only `/admin/audit` endpoint (dashboard viewer included).
  See `docs/security-hardening.md` for production setup guidance (tokens/tenants/TLS/logging/branch protection).

## Architecture

The Service Layer follows a clean layered architecture inspired by operating system design:

```
┌─────────────────────────────────────────────────┐
│     Services Layer (Applications)               │
│     internal/services/ - Business services      │
├─────────────────────────────────────────────────┤
│     Engine Layer (OS Kernel)                    │
│     internal/engine/ - Lifecycle, Bus, Health   │
├─────────────────────────────────────────────────┤
│     Framework Layer (SDK)                       │
│     internal/framework/ - ServiceBase, Builder  │
├─────────────────────────────────────────────────┤
│     Platform Layer (Drivers)                    │
│     internal/platform/ - RPC, Storage, Cache    │
└─────────────────────────────────────────────────┘
```

- **Platform**: Hardware abstraction layer with drivers for databases, blockchain RPC, caching
- **Framework**: Developer tools including ServiceBase, ServiceBuilder, and testing utilities
- **Engine**: Service orchestration with lifecycle management, event bus, and health monitoring
- **Services**: Domain services (accounts, functions, oracle, VRF, etc.)

See [Architecture Documentation](docs/architecture-layers.md) for details.

## Repo Layout (Engine vs Services)
- `internal/engine` — the Android-style service engine (OS): lifecycle, readiness, buses, and module registry.
- `internal/engine/runtime` — runtime builder that wires the engine to storage, HTTP, and domain modules.
- `internal/services` — domain services (apps) such as accounts, functions, gasbank, oracle, feeds, datastreams, VRF, etc.
- `internal/services/core` — shared service helpers (base validation, dispatch, retry/observe wrappers).
- `internal/app/httpapi` — HTTP transport that exposes the engine/ services via REST and the system bus endpoints.

## Quick Start

Local full-stack (API + Postgres + dashboard + marketing site):

```bash
git clone https://github.com/R3E-Network/service_layer.git
cd service_layer
make run  # copies .env.example if missing, then docker compose up -d --build
```

Once up:
- API: http://localhost:8080 (auth: `Authorization: Bearer dev-token`, or Supabase GoTrue JWTs when `SUPABASE_JWT_SECRET` is set; `/auth/login` stays available for local users from `AUTH_USERS` and reuses the Supabase JWT secret when `AUTH_JWT_SECRET` is empty)
- Dashboard: http://localhost:8081 (prefills when opened as `http://localhost:8081/?api=http://localhost:8080&token=dev-token&tenant=<id>`)
- Public site: http://localhost:8082
- Supabase services: the core compose stack always runs a self-hosted Supabase Postgres (`supabase-postgres`). Enable the full Supabase surface (GoTrue/PostgREST/Kong/Studio) with `docker compose --profile supabase up -d --build` (or `--profile all`). Refresh tokens and Studio rely on this profile.
- Supabase smoke: `make supabase-smoke` starts the Supabase profile and runs a quick `/auth/refresh` (via appserver) + `/system/status` health check (requires Docker/curl/jq; set `SUPABASE_REFRESH_TOKEN` to exercise refresh proxy).
- Multi-tenant note: include `X-Tenant-ID` (or `--tenant` in CLI) when creating an account; all subsequent access to that account and its resources must use the same tenant header. Set `REQUIRE_TENANT_HEADER=true` to enforce tenant headers at the API (recommended for prod); admin endpoints always require both an admin JWT and a tenant header.
- Dashboard settings include an optional Tenant field that will be sent as `X-Tenant-ID` for all API calls when populated.
- Each account card includes a “Deep link” that pre-fills the dashboard base URL, token, and the account’s tenant for quick sharing (local storage values are reused for base URL/token).
- NEO observability: `/neo/status` reports the latest indexed height/hash/state root from the Postgres-backed indexer, `/neo/blocks` and `/neo/blocks/{height}` expose normalized blocks/txs/notifications/VM state, and `/neo/snapshots` reads manifests produced by `cmd/neo-snapshot` (from `NEO_SNAPSHOT_DIR`, default `./snapshots`).
- NEO storage: `/neo/storage/{height}` returns per-contract KV blobs captured for that block to support stateless execution; use `slctl neo storage <height>` or the dashboard NEO panel to inspect.
- NEO storage summary: `/neo/storage-summary/{height}` (and `slctl neo storage-summary <height>`) returns per-contract counts of KV and diff entries without streaming full blobs.
- NEO storage diffs: `/neo/storage-diff/{height}` returns only changed keys vs the prior stored height; snapshots include optional diff bundles when stored diffs are available.
- Snapshot manifests include hashes (and optional signatures) for full + diff bundles when generated via `cmd/neo-snapshot`; supply `NEO_SNAPSHOT_DSN` to reuse captured storage/diffs instead of hitting RPC. The dashboard “Verify” button validates bundle hashes and the manifest signature when provided.
- Snapshot bundles can be downloaded directly via `/neo/snapshots/{height}/kv` (and `/kv-diff` when present) — manifests automatically include relative `kv_url`/`kv_diff_url` pointing at these endpoints when URLs are not provided at generation time.
- NEO node health: set `NEO_RPC_STATUS_URL` so `/neo/status` reports node height/lag relative to the indexer.
- Stable view: `NEO_STABLE_BUFFER` (default 12) subtracts a safety window from `latest_height` to derive `stable_height/hash/state_root` in `/neo/status`/`/neo/checkpoint`.
- CLI helpers: `slctl neo download --height <h> [--diff] [--sha <sha>]` to pull bundles; the dashboard snapshot list now includes download + verify actions for KV and diff bundles with relative URL support.
- End-to-end verify: `slctl neo verify-all --height <h>` (or `--manifest http://localhost:8080/neo/snapshots/<h>` / `--heights h1,h2`) downloads manifest + bundles, verifies hashes/signature, and writes outputs.
- Ops shortcut: `/neo/checkpoint` and `slctl neo checkpoint` return a concise view of indexer height/hash/node lag. Dashboard snapshot verification results are persisted per API endpoint and can be re-run with the “Verify all” button.
- CI/branch protection: keep the `neo-smoke` workflow required on `master` (see `docs/branch-protection.md`); it runs Go tests, dashboard typecheck, and a mocked NEO smoke curl.
- Operations runbook: see `docs/ops-runbook.md` for start/stop, health, logging, NEO nodes, and hardening pointers.
- Snapshots directory: compose mounts `./snapshots` into `/app/snapshots` so the appserver can serve locally generated manifests/bundles (`NEO_SNAPSHOT_DIR` defaults to `/app/snapshots`).
- Engine modules: `/system/status` now includes the list of registered modules (store/app/services/runners) with name, domain, category, lifecycle status, readiness, timestamps, and supported interfaces. It also returns a summary of data/event/compute modules. The dashboard auto-refreshes this every 30s and surfaces warnings/toasts if modules fail/stop or report not-ready. Start/stop timings, uptime, and slow modules (threshold configurable via `MODULE_SLOW_MS`, `runtime.slow_module_threshold_ms` in config, or `appserver -slow-ms`) are surfaced in status, CLI, and dashboard.
- Module slow/uptime: `/system/status`/`slctl`/dashboard surface start/stop timings, uptimes, and slow modules. Tune the slow threshold via `MODULE_SLOW_MS` (ms); the value is echoed as `modules_slow_threshold_ms` in status responses for observability.
- Auto-wired layering: `AUTO_DEPS_FROM_APIS=true` (default) lets the engine add dependency edges from service `RequiresAPIs` declarations (store/compute/data/event/etc.) to providers automatically. Keeps the lower platform/infra layers starting before services even when module names differ. Disable via `AUTO_DEPS_FROM_APIS=false` for narrow tests.
- Persistence is Supabase-first: supply `DATABASE_URL` (Supabase Postgres DSN). The runtime will fail fast if no DSN is provided.
- Supabase profile: `docker compose --profile supabase up -d --build` adds GoTrue/PostgREST/Kong/Studio to the core stack. End-to-end auth (refresh tokens) is documented in `docs/supabase-setup.md`.
- System bus: `/system/events|data|compute` fan-out endpoints are admin-only. Use an admin JWT/role (e.g., Supabase admin role mapping) rather than API tokens.
- SDKs and on-chain helpers: `sdk/typescript/client` and `sdk/go/client` expose typed API clients (with Supabase refresh-token support). See `docs/blockchain-contracts.md` plus `examples/neo-privnet-contract*` for pushing price feed data into privnet contracts.
- Randomness: set `RANDOM_SIGNING_KEY` to a persistent ed25519 private key to keep randomness signatures stable across restarts; otherwise keys rotate on each boot.

CLI or manual server:

```bash
export API_TOKENS=dev-token   # or set AUTH_USERS for JWT: admin:changeme:admin
go run ./cmd/appserver -dsn "postgres://supabase_admin:supabase_pass@localhost:5432/service_layer?sslmode=disable"
go run ./cmd/slctl --token "$API_TOKENS" accounts list
```

## Tests

- Go: `go test ./...`
- TypeScript SDK: `npm run test:sdk` (build happens via pretest hook; uses Node 20)
- Dashboard typecheck/tests: `npm run test:dashboard` or `npm run typecheck:dashboard` (Node 20 via `.nvmrc`)

Auditing (optional):
- Set `AUDIT_LOG_PATH=/var/log/service-layer-audit.jsonl` to persist audit events (JSONL) alongside Supabase storage.
- View recent audit entries via `GET /admin/audit?limit=200` (admin JWT required) or the dashboard Admin panel. Token-only auth is not admin.
 - When running with PostgreSQL, audit entries are also stored in `http_audit_log`.

Examples for Devpack usage live under `examples/functions/devpack` (JS + TS samples for price feeds, randomness, gasbank/oracle orchestration). API examples for all services are in `docs/examples/services.md`. Polyglot SDKs mirroring the Devpack surface live under `sdk/go`, `sdk/rust`, and `sdk/python`.

Check `examples/functions/devpack` for a TypeScript project that uses the SDK to
ensure gas accounts and submit oracle requests.

## Operator Interfaces

- **CLI (`cmd/slctl`)** — wraps the HTTP API for scripting. Honours `SERVICE_LAYER_ADDR`
  and `SERVICE_LAYER_TOKEN` like the server; set `--tenant` / `SERVICE_LAYER_TENANT` to send `X-Tenant-ID` when needed. Use it to create accounts, register functions,
  request randomness (`slctl random generate --account <id> --length 64`) or inspect recent draws (`slctl random list --account <id>`), and inspect automation/oracle history from a terminal.
- **Dashboard (`apps/dashboard`)** — React + Vite SPA for day-to-day operations. See
  `apps/dashboard/README.md` for Docker/local instructions. Configure API and Prometheus
  endpoints in the UI once the server is running. The NEO panel (if enabled server-side) shows
  indexed blocks/state roots and available stateless snapshots with download links.
- **Supabase console (`src/`)** — React + TypeScript + Vite app for user/admin flows backed by Supabase. Run `pnpm install && pnpm dev` from the repo root. It ships with `@vitejs/plugin-react`; swap to `@vitejs/plugin-react-swc` if you prefer SWC. For type-aware linting, enable the `tseslint.configs.recommendedTypeChecked` preset in `eslint.config.js` and consider `eslint-plugin-react-x`/`eslint-plugin-react-dom` as in the Vite template.

### CLI Quick Reference
- `slctl accounts list|get|create|delete` — manage account records.
- `slctl functions list|get|create|delete` (+ execution helpers) — deploy and inspect functions.
- `slctl automation jobs ...` / `slctl secrets ...` — administer schedulers and secret vault entries.
- `slctl gasbank ...` — view balances and transfer history.
- `slctl oracle sources|requests ...` — configure HTTP adapters and inspect inflight work.
- `slctl datastreams ...` — list/create streams or publish frames.
- `slctl datalink ...` — list/create channels and queue deliveries.
- `slctl datafeeds ...` — manage data feed definitions and submit/list rounds (with per-feed aggregation).
- `slctl pricefeeds list|create|get|update|delete|snapshots` — define asset pairs with deviation-based publishing and monitor submissions. Supports `--deviation`, `--interval`, `--heartbeat` flags.
- `slctl jam ...` — upload preimages and submit/list packages/reports.
- `slctl random generate --account <id> --length <n>` — request deterministic bytes.
- `slctl random list --account <id> [--limit n]` — fetch recent `/random/requests` history.
- `slctl cre playbooks|executors|runs --account <id>` — inspect Chainlink Reliability Engine assets and activity.
- `slctl ccip lanes|messages --account <id>` — list cross-chain lanes and recent CCIP messages.
- `slctl vrf keys|requests --account <id>` — inspect VRF key inventory and recent randomness requests.
- `slctl datalink channels|deliveries --account <id>` — inspect data movement channels and recent delivery attempts.
- `slctl dta products|orders --account <id>` — inspect DTA product catalogues and order history.
- `slctl datastreams streams|frames --account <id>` — inspect high-frequency streams and recent frames.
- `slctl confcompute enclaves --account <id>` — inspect confidential-compute enclave inventory.
- `slctl jam status|packages|reports|receipt|receipts` — inspect JAM status, packages/reports, and accumulator receipts/roots.
- `slctl workspace-wallets list --account <id>` — inspect registered signing wallets.
- `slctl services list` — dump `/system/descriptors` for feature discovery.
- `slctl bus events|data|compute ...` — publish to the engine bus (`/system/events|data|compute`) for cross-service fan-out (admin token/JWT required).
- `slctl status` — fetch `/system/status` with a modules table, JAM config, and service descriptors.
- `slctl neo status|blocks|block|snapshots` — inspect NEO indexed data and snapshot manifests served by the API.
- `slctl neo storage <height>` — fetch per-contract storage blobs captured for a block.
- `slctl neo storage-diff <height>` — fetch per-contract storage diffs for a block.
- `slctl neo storage-summary <height>` — quick per-contract counts of KV and diff entries for a block.
- `slctl neo verify --url <bundle> --sha <sha256>` — download a KV bundle and verify its SHA256 (or use `--file` for a local path).
- `slctl neo verify-manifest --url <manifest>` — verify an ed25519 signature on a snapshot manifest (payload: `network|height|state_root|kv_sha256|kv_diff_sha256`).
- `slctl dashboard-link [--dashboard http://localhost:8081]` — emit a ready-to-open dashboard URL with `api`, `token` (or `refresh_token` when provided), and `tenant` query params prefilled from your CLI flags/env. Supply `SUPABASE_REFRESH_TOKEN` (or `--refresh-token`) to have the CLI fetch a fresh access token via `/auth/refresh` when needed.
- `slctl manifest --url <manifest>` — fetch a snapshot manifest, verify KV and diff bundle hashes, and validate the manifest signature in one step.
- `slctl status` — fetch `/system/status` to inspect server health, readiness, version, and services.
- `slctl version` — print CLI build info and query `/system/version` on the server.
- `slctl gasbank summary --account <id>` — view balances, pending withdrawals, and recent gas bank activity.
- See `docs/gasbank-workflows.md` for a full ensure → deposit → scheduled/multi-sig withdraw walkthrough (CLI + HTTP) plus settlement retry/DLQ commands embraced by both Devpack and the dashboard.
- `slctl audit [--limit N] [--offset N] [--user u] [--role r] [--tenant t] [--method get] [--contains /path] [--status 200] [--format table]` — admin-only; fetch recent audit entries (requires admin JWT, not token-only auth). Supabase roles listed in `SUPABASE_ADMIN_ROLES` are mapped to `admin` for these endpoints.

### Docker

```bash
# Core stack: appserver + Postgres + dashboard + site
make run

# Add privnet Neo node + indexer (RPC: 20332)
make run-neo

# Add Prometheus/Grafana
make run-monitoring

# Full dev cockpit (core + monitoring + pgAdmin)
make run-dev

# Everything (all profiles)
make run-all

# Supabase auth/postgrest/studio (self-hosted Supabase surface)
docker compose --profile supabase up -d --build
```

The compose file mounts configs at `/app/configs/config.yaml` and waits for
Supabase Postgres health (`supabase-postgres`) before starting the appserver.
Defaults include `API_TOKENS=dev-token` and a sample `SECRET_ENCRYPTION_KEY` for
local use; copy `.env.example` to `.env` to override. Authenticate with
`Authorization: Bearer <token>`; query tokens are disabled. The Neo privnet
stack runs `neo-go` on `20332` with the indexer pointed at `supabase-postgres`.

Once running:
- API: `http://localhost:8080` (JWT via `/auth/login` or bearer token)
- Dashboard: `http://localhost:8081`
- Public site: `http://localhost:8082`
- Prometheus/Grafana (profiles `monitoring`/`dev`): `http://localhost:9090` / `http://localhost:3000` (admin/admin)
- pgAdmin (profile `dev`): `http://localhost:5050` (admin@local.dev/admin)
- Health: `/livez`, `/readyz` (`/healthz`), `/metrics`

### SDK Quickstart (TypeScript + Go)

- TypeScript: `npm install ./sdk/typescript/client`
- Go: `go get github.com/R3E-Network/service_layer/sdk/go/client`

TypeScript:

```ts
import { ServiceLayerClient } from '@service-layer/client';

const sl = new ServiceLayerClient({
  baseURL: 'http://localhost:8080',
  token: 'dev-token',
  tenantID: '<tenant-id>',
});

const account = await sl.accounts.create('alice', { env: 'dev' });
const wallet = await sl.workspaceWallets.create(account.ID, { wallet_address: '<ADDR>' });
const fn = await sl.functions.create(account.ID, { name: 'hello', source: '() => ({ ok: true })' });
const exec = await sl.functions.execute(account.ID, fn.ID, { msg: 'hi' });
const rand = await sl.random.generate(account.ID, { length: 32, request_id: 'sample' });
const gas = await sl.gasBank.ensureAccount(account.ID, { wallet_address: '<ADDR>' });
```

Go:

```go
package main

import (
	"context"
	"fmt"

	sl "github.com/R3E-Network/service_layer/sdk/go/client"
)

func main() {
	ctx := context.Background()
	client := sl.New(sl.Config{BaseURL: "http://localhost:8080", Token: "dev-token", TenantID: "<tenant-id>"})

	acct, _ := client.Accounts.Create(ctx, "alice", map[string]string{"env": "dev"})
	wallet, _ := client.WorkspaceWallets.Create(ctx, acct.ID, sl.CreateWorkspaceWalletRequest{WalletAddress: "<ADDR>"})
	fn, _ := client.Functions.Create(ctx, acct.ID, sl.CreateFunctionParams{Name: "hello", Source: "() => ({ok:true})"})
	exec, _ := client.Functions.Execute(ctx, acct.ID, fn.ID, map[string]any{"msg": "hi"})
	rand, _ := client.Random.Generate(ctx, acct.ID, sl.GenerateRandomParams{Length: 32})
	fmt.Println(wallet.ID, exec.ID, rand.Value)
}
```

## Configuration Notes

- `DATABASE_URL` (env) or `-dsn` (flag) control persistence. When omitted, the
  runtime keeps everything in memory.
- `auth.tokens` (config), `API_TOKENS`/`API_TOKEN` (env), or `-api-tokens` (flag)
  configure bearer tokens for HTTP authentication. All protected requests must
  present `Authorization: Bearer <token>`; `/readyz` (`/healthz`) and `/system/version` stay
  public. When no tokens are configured, protected endpoints return 401 and the
  server logs a warning. Always set tokens for any deployment.
- Startup safety: when using PostgreSQL, the server validates that all tenant
  columns exist (as added in migrations `0024`/`0025`). If a legacy schema
  without tenants is detected, startup fails early with an actionable error so
  tenant enforcement is never bypassed silently.
- Oracle dispatcher settings honour the runtime config or `ORACLE_*` env vars:
  `ORACLE_TTL_SECONDS`, `ORACLE_MAX_ATTEMPTS`, `ORACLE_BACKOFF`, and
  `ORACLE_DLQ_ENABLED` control retry/backoff/expiry. `ORACLE_RUNNER_TOKENS`
  (or `runtime.oracle.runner_tokens`) require runner callbacks to include
  `X-Oracle-Runner-Token: <token>` alongside normal API authentication. When
  unset, callbacks only require API tokens. Set multiple runner tokens with
  `ORACLE_RUNNER_TOKENS=tok1,tok2` (`,` or `;` separators).
- Gas bank settlement requires `GASBANK_RESOLVER_URL` (+ optional
  `GASBANK_RESOLVER_KEY`). Tuning knobs include `GASBANK_POLL_INTERVAL`
  (duration string, default 15s) and `GASBANK_MAX_ATTEMPTS` (default 5) for
  retry/DLQ behaviour (or `runtime.gasbank.poll_interval` / `runtime.gasbank.max_attempts`
  in `configs/config.yaml`).
- `security.secret_encryption_key` (config) or `SECRET_ENCRYPTION_KEY` (env)
  provide the AES key for secret storage. A key is required when using
  persistent stores.
- `SECRET_ENCRYPTION_KEY` enables AES-GCM encryption for stored secrets (16/24/32
  byte raw, base64, or hex keys are supported). It is required when using
  PostgreSQL.
- `PRICEFEED_FETCH_URL` and `GASBANK_RESOLVER_URL` point
  to the external services responsible for price data and
  withdrawal settlement. Optional `*_KEY` environment variables attach bearer
  tokens when calling those endpoints.
- Data feed aggregation supports `median` (default), `mean`, `min`, and `max`.
  Set a global default via `runtime.datafeeds.aggregation` / `DATAFEEDS_AGGREGATION`,
  and override per feed by supplying `aggregation` in the data feed create/update
  payloads.
- Oracle data sources are configured per-feed via the HTTP API; no global
  resolver URL is required.
- `RANDOM_SIGNING_KEY` (base64 or hex encoded ed25519 private key) enables
  deterministic signatures for the randomness API. When omitted, a fresh key is
  generated on startup and returned with each response.
- The `runtime` block in `configs/config.yaml` mirrors the legacy environment
  variables for TEE mode selection, random signing keys, price feed fetchers,
  gas bank settlement resolvers, and the CRE HTTP runner toggle. Populate this
  section (or set the corresponding env vars) to drive the new builder-based
  application wiring. CLI flags continue to take precedence where applicable.
- `configs/config.yaml` and `configs/examples/appserver.json` provide
  overrideable samples for the refactored runtime (see `configs/README.md` for details). `configs/config.migrate.yaml` is a variant that enables `database.migrate_on_start=true` for environments where you want the server to run migrations automatically on boot.

## Project Layout

```
cmd/
  appserver/           - runtime entry point
apps/
  dashboard/           - React + Vite operator surface (only maintained front-end)
  site/                - Public marketing site served at :8082
configs/               - sample configuration files
docs/                  - specification + documentation index
examples/              - runnable Devpack samples
internal/app/          - services, storage adapters, HTTP API
internal/config/       - configuration structs & helpers
internal/platform/     - database helpers and migrations
internal/version/      - build/version metadata
pkg/                   - shared utility packages (logger, errors, etc.)
sdk/devpack/           - TypeScript SDK consumed by function authors
sdk/go/devpack/        - Go helpers mirroring the Devpack action surface
sdk/rust/devpack/      - Rust helpers mirroring the Devpack action surface
sdk/python/devpack/    - Python helpers mirroring the Devpack action surface
sdk/go/client/         - Go HTTP client for the Service Layer API
sdk/typescript/        - TypeScript HTTP client for the Service Layer API
scripts/               - automation helpers (see scripts/README.md)
src/                   - Supabase-backed React + Vite app (user/admin console)
```

## Documentation

All project documentation lives under `docs/`. Start with [`docs/README.md`](docs/README.md)
for navigation and context.

### Getting Started

| Document | Description |
|----------|-------------|
| [Quickstart Tutorial](docs/quickstart-tutorial.md) | **Start here** - Zero to running in 15 minutes |
| [Service Catalog](docs/service-catalog.md) | Complete reference for all 17 services |
| [Developer Guide](docs/developer-guide.md) | Building and extending the Service Layer |

### Architecture

| Document | Description |
|----------|-------------|
| [Architecture Layers](docs/architecture-layers.md) | 4-layer design (Platform → Framework → Engine → Services) |
| [Framework Guide](docs/framework-guide.md) | ServiceBase, Builder, Manifest, Testing utilities |
| [Engine Guide](docs/engine-guide.md) | Registry, Lifecycle, Bus, Health monitoring |

### Operations & Deployment

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/deployment-guide.md) | Production deployment with Docker/Kubernetes |
| [Operations Runbook](docs/ops-runbook.md) | Start/stop, monitoring, troubleshooting |
| [Security Hardening](docs/security-hardening.md) | Production security configuration |

### Service Tutorials

| Service | Tutorial |
|---------|----------|
| Price Feeds | [docs/examples/pricefeeds.md](docs/examples/pricefeeds.md) - Deviation-based oracle aggregation |
| Data Feeds | [docs/examples/datafeeds.md](docs/examples/datafeeds.md) - Chainlink-style signed feeds |
| DataLink | [docs/examples/datalink.md](docs/examples/datalink.md) - Data delivery channels |
| Automation | [docs/examples/automation.md](docs/examples/automation.md) - Cron-style job scheduling |
| Secrets | [docs/examples/secrets.md](docs/examples/secrets.md) - Encrypted secret storage |
| Randomness | [docs/examples/randomness.md](docs/examples/randomness.md) - VRF and signed random |
| Event Bus | [docs/examples/bus.md](docs/examples/bus.md) - Pub/sub messaging |
| NEO | [docs/neo-api.md](docs/neo-api.md) - Indexer and snapshot APIs |
| Supabase | [docs/supabase-setup.md](docs/supabase-setup.md) - Running Supabase Postgres for the Service Layer |

### Code Examples

Working code examples are available in `examples/`:
- `examples/custom-service/` - Complete custom service implementation
- `examples/functions/devpack/` - TypeScript Devpack SDK examples
- `examples/neo-privnet-contract/` - Neo privnet helper: pull Service Layer price feed + invoke a contract via neon-js
- `examples/neo-privnet-contract-go/` - Go helper: pull Service Layer price feed + invoke a privnet contract via neo-go

## Development

- Quick targets:
  - `make build` / `make test` (build outputs land in `./bin`)
- `make run` brings up Postgres + appserver + dashboard via docker compose (detached) and prints port info.
- `make run-local` runs the appserver binary directly; export `DATABASE_URL` to point at Postgres.
- `make build-dashboard` builds the React UI (Node 20+, npm).
- `make typecheck` runs the dashboard TypeScript check; `make smoke` runs Go tests plus dashboard typecheck.
- `make docker` builds the appserver + dashboard images.
- `make docker-compose` (or `make docker-compose-run`) brings up Postgres + appserver + dashboard with sensible defaults.
- Run **all** tests: `go test ./...`
- Go modules are vendored for offline Docker builds; run `go mod vendor` after
  updating dependencies.
- `make neo-up` / `make neo-down` start/stop optional neo-cli mainnet/testnet nodes (compose profile `neo`).
- NEO tooling: `cmd/neo-indexer` (persists blocks/tx/notifications via RPC + Postgres), `cmd/neo-snapshot` (state root + contract KV bundle). Compose profile `neo` brings up mainnet/testnet nodes (off by default).

### Tenant quickstart
- See `docs/tenant-quickstart.md` for headers, dashboard deep links, CLI flags, and common 403 fixes when running with tenants locally.
- Fast API smoke (tenant-scoped):
```bash
curl -X POST http://localhost:8080/accounts \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-a" \
  -d '{"owner":"demo","metadata":{"tenant":"tenant-a"}}'
curl -H "Authorization: Bearer dev-token" -H "X-Tenant-ID: tenant-a" http://localhost:8080/accounts
```

### NEO layering plan
- See `docs/neo-layering.md` for the roadmap to run full NEO nodes (mainnet/testnet), indexers, and per-block stateless state snapshots with trusted state roots.
- See `docs/neo-ops.md` for running neo-cli nodes via the `neo` compose profile (ports, plugins, volumes).
