# slctl (Service Layer CLI)

Lightweight HTTP wrapper around the Service Layer API for scripting and ops.

## Common flags/env
- `--addr` / `SERVICE_LAYER_ADDR` (default `http://localhost:8080`)
- `--token` / `SERVICE_LAYER_TOKEN` bearer token; `--refresh-token` / `SUPABASE_REFRESH_TOKEN` to auto-refresh via `/auth/refresh`
- `--tenant` / `SERVICE_LAYER_TENANT` to send `X-Tenant-ID`
- `--timeout` (default 15s)

Run locally: `go run ./cmd/slctl --token "$SERVICE_LAYER_TOKEN" --tenant <id> accounts list`

## File map (post-refactor)
- `core.go` — entrypoint, flag parsing, command dispatch
- `client.go` — HTTP client, auth/refresh helpers
- `helpers.go` — shared JSON/flag utilities
- `system.go` / `system_status.go` — status/services/tenant/dashboard/audit handlers
- `bus.go` — event/data/compute fan-out
- `accounts.go` — accounts + workspace wallets
- `functions.go` — function CRUD/execution
- `automation.go` — scheduled jobs
- `secrets.go` — account secrets
- `gasbank.go` — gas bank accounts, transfers, approvals
- `oracle.go` — sources/requests
- `datafeeds.go` — data feeds, price feeds, randomness
- `chainlink.go` — CRE, CCIP, VRF surfaces
- `datalink.go` — channel delivery
- `dta.go` — digital transfer agency helpers
- `datastreams.go` — stream definitions/frames/publish
- `confcompute.go` — confidential compute enclaves
- `neo.go`, `jam.go`, `manifest.go` — NEO snapshots, JAM prototype, manifest verification
