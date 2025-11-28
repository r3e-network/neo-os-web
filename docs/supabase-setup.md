# Supabase Setup (Self-Hosted)

The Service Layer now targets a self-hosted Supabase Postgres backend (no in-memory mode). This guide shows how to run the minimal Supabase Postgres service used by the runtime.

## Quick Start (docker compose)

The base compose file always runs a self-hosted Supabase Postgres (`supabase-postgres`) for the runtime:

- Host: `supabase-postgres`
- Port: `5432`
- User: `supabase_admin`
- Password: `supabase_pass`
- DB: `service_layer`

Bring up the core stack (appserver + Supabase Postgres + dashboard/site):
```bash
make run
```

To enable the full Supabase surface (Auth/GoTrue, PostgREST, Kong gateway, Studio) for refresh tokens and admin UI, start the Supabase profile:
```bash
docker compose --profile supabase up -d --build      # Auth + PostgREST + Kong + Studio
# or
docker compose --profile all up -d --build           # everything including monitoring/neo if configured
```

Environment variables (see `.env.example`):
```bash
DATABASE_URL=postgres://supabase_admin:supabase_pass@supabase-postgres:5432/service_layer?sslmode=disable
SECRET_ENCRYPTION_KEY=***REMOVED***
SUPABASE_JWT_SECRET=***REMOVED***          # used to validate GoTrue-issued JWTs
SUPABASE_JWT_AUD=authenticated                # optional env; matches Supabase default
SUPABASE_ANON_KEY=supabase-anon-key           # GoTrue anon key
SUPABASE_SERVICE_ROLE_KEY=***REMOVED***
SUPABASE_ADMIN_ROLES=service_role,admin       # roles elevated to admin inside the Service Layer
SUPABASE_TENANT_CLAIM=app_metadata.tenant     # optional claim path for tenant mapping
SUPABASE_HEALTH_URL=http://supabase-gotrue:9999/health # optional: surfaced in /system/status
SUPABASE_HEALTH_GOTRUE=http://supabase-gotrue:9999/health
SUPABASE_HEALTH_POSTGREST=http://supabase-postgrest:3000
SUPABASE_HEALTH_KONG=http://supabase-kong:8000/health
SUPABASE_HEALTH_STUDIO=http://supabase-studio:3000
SUPABASE_ROLE_CLAIM=app_metadata.role         # optional claim path for role mapping
```

## Auth (GoTrue)

- The compose profile includes GoTrue + Kong. Default JWT signing secret comes
  from `SUPABASE_JWT_SECRET` (in `.env.example`).
- The Service Layer validates Supabase JWTs automatically when
  `SUPABASE_JWT_SECRET` is set; set `SUPABASE_JWT_AUD` if you customize the
  audience in GoTrue.
- `SUPABASE_GOTRUE_URL` is required when `SUPABASE_JWT_SECRET` is set so
  `/auth/refresh` can proxy refresh tokens against your self-hosted GoTrue.
- Map Supabase roles to Service Layer admin by setting
  `SUPABASE_ADMIN_ROLES=service_role,admin` (comma-separated). Matching tokens
  are treated as admin for `/admin` endpoints.
- Derive tenant automatically from a claim via `SUPABASE_TENANT_CLAIM`
  (dot-notation supported, e.g., `app_metadata.tenant`); used when `X-Tenant-ID`
  is not provided.
- Surface Supabase health in `/system/status` by setting one or more of
  `SUPABASE_HEALTH_URL`, `SUPABASE_HEALTH_GOTRUE`, `SUPABASE_HEALTH_POSTGREST`,
  `SUPABASE_HEALTH_KONG`, `SUPABASE_HEALTH_STUDIO`.
- Derive roles from a custom claim via `SUPABASE_ROLE_CLAIM`
  (dot-notation supported, e.g., `app_metadata.role`); admin role mapping still
  applies afterwards.
  Health checks include per-endpoint latency (`duration_ms`) when enabled.
- For dashboard/CLI session renewal, supply a Supabase refresh token via
  `SUPABASE_REFRESH_TOKEN`; the CLI (`slctl --refresh-token`) and `/auth/refresh`
  proxy will exchange it against your self-hosted GoTrue.
- `/auth/login` remains available for local users when `AUTH_USERS` is set.
  If `AUTH_JWT_SECRET` is empty, the Supabase JWT secret is reused so you do not
  manage two signing keys.

## Migrations

Migrations are embedded. Control auto-apply with either the legacy `-migrate` flag or `database.migrate_on_start` in `configs/config.yaml` (see `configs/config.migrate.yaml` for an opt-in sample). Default is on for the flag in older setups; sample configs now default to off for safer shared environments. The runtime fails fast if the DSN is missing or unreachable.
For Supabase deployments, prefer controlled migrations (CI/CD) and enable `migrate_on_start` only in transient/local stacks or when you explicitly manage change windows.

## Admin Access

- Connect via any Postgres client: `psql postgres://supabase_admin:supabase_pass@localhost:5432/service_layer`
- If you start the `supabase` profile, Supabase Studio is available at `http://localhost:3000` (default creds via `SUPABASE_SERVICE_ROLE_KEY`). Kong proxies GoTrue/PostgREST at `http://localhost:8000` using the bundled `devops/supabase/kong.yml`.

## TLS / Production

- Enable SSL in your Supabase Postgres deployment and set `sslmode=require` in `DATABASE_URL`.
- Rotate `supabase_admin` credentials and restrict network exposure; keep the DB inside a private network alongside the appserver.

## Runtime Expectations

- `DATABASE_URL` is required; there is no in-memory fallback.
- Secret encryption key is required when persistence is enabled.
- All services (accounts, gasbank, feeds, etc.) share the Supabase Postgres store; multi-tenant enforcement remains unchanged.

## Tooling

- `DATABASE_URL` is respected by all config loaders and `cmd/appserver`, so `.env` or Compose overrides apply consistently.
- SDKs: `sdk/typescript/client` and `sdk/go/client` support Supabase refresh tokens for auto-renewing access tokens.
- On-chain helpers: see `docs/blockchain-contracts.md` and `examples/neo-privnet-contract*` for pushing price feeds into privnet contracts.
- Smoke check: run `make supabase-smoke` (or `./scripts/supabase_smoke.sh`) to start the Supabase compose profile and verify GoTrue/PostgREST/Kong/Studio health and `/auth/refresh` proxying via the appserver.
