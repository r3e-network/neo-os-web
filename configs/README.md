# Configuration Reference

All configuration expectations, required environment variables, and runtime flags
are defined in the [`Neo Service Layer Specification`](../docs/requirements.md).
This directory simply contains samples you can copy when bootstrapping local
environments.

## Files
- `config.yaml` – canonical YAML sample consumed by `cmd/appserver`. Uncomment or
  edit sections before passing `-config configs/config.yaml`.
- `examples/appserver.json` – JSON version used in documentation snippets.
- `prometheus.yml` – example scrape config aligned with the `/metrics` surface.
- `config.migrate.yaml` – starter with `database.migrate_on_start: true` for teams that prefer auto-migrations at boot (PostgreSQL only).

Always update the specification first when adding/removing configuration fields. File
paths are workspace-relative; you can use absolute paths if preferred.

## Database Block

- Persistence is Supabase-first: set `database.dsn` or export `DATABASE_URL` (preferred) to point at your self-hosted Supabase Postgres. The runtime has no in-memory fallback outside of tests.
- `DATABASE_URL` overrides any file-based DSN automatically so Compose or `.env` values apply consistently.
- TLS: set `sslmode=require` in `DATABASE_URL` for production. Connection pool knobs mirror the config fields (`max_open_conns`, `max_idle_conns`, `conn_max_lifetime`).
- `migrate_on_start` (bool, default true): run migrations automatically at startup. Leave it enabled for local/dev; set to false in shared/prod when migrations are orchestrated separately.

## Runtime Block

The `runtime` section consolidates what used to be scattered environment
variables for the orchestration runtime:

- `tee.mode` — selects between the mock executor (`"mock"`) and the enclave
  executor (`"enclave"`, or leave empty).
- `random.signing_key` — optional ed25519 private key for deterministic random
  responses (base64 or hex encoded). Recommended to set in production so
  randomness signatures remain stable across restarts.
- `pricefeed.fetch_url` / `pricefeed.fetch_key` — configure the background price
  feed refresher HTTP fetcher.
- `gasbank.resolver_url` / `gasbank.resolver_key` — configure the settlement
  poller HTTP resolver, with `gasbank.poll_interval` and `gasbank.max_attempts`
  controlling retry cadence.
- `oracle.ttl_seconds` / `oracle.max_attempts` / `oracle.backoff` /
  `oracle.dlq_enabled` — control resolver retry cadence and expiry; exhausted
  requests are dead-lettered when enabled.
- `oracle.runner_tokens` — optional list of runner callback tokens; when set,
  status updates must present a matching `X-Oracle-Runner-Token` (API tokens
  are still required). Environment overrides (`ORACLE_RUNNER_TOKENS`) accept
  comma- or semicolon-separated lists.
- `datafeeds.min_signers` / `datafeeds.aggregation` — defaults for Chainlink
  data feed submissions (strategies: `median`, `mean`, `min`, `max`).
- `datastreams` / `datalink` — currently rely on service defaults; no runtime
  toggles are required.
- `cre.http_runner` — enables the HTTP CRE runner integration.
- Env-only toggles:
  - `REQUIRE_TENANT_HEADER=true` to hard-enforce tenant headers across authenticated requests (recommended for production).
  - `BUS_MAX_BYTES` to cap `/system/events|data|compute` payload sizes (default 1 MiB).

Every field still honours its corresponding environment variable, so you can
mix-and-match config files and env overrides as needed.

## Auth Block

Use the `auth` section to declare static bearer tokens consumed by the HTTP
gateway. Populate `tokens` with one or more strings. Environment variables
(`API_TOKENS` / `API_TOKEN`) and the `-api-tokens` flag continue to override or
supplement the list when necessary. If no tokens are configured, JWT logins are
still accepted when `AUTH_USERS` + `AUTH_JWT_SECRET` are set; otherwise all
protected endpoints return 401 and only `/healthz` + `/system/version` remain
public for probes/discovery. Local defaults set `API_TOKENS=dev-token` and
`AUTH_USERS=admin:changeme:admin` for a quick compose experience—override both
for any shared environment. JWT tokens and static tokens can be supplied via
`Authorization: Bearer ...` headers. Avoid query parameters for tokens.

Supabase JWTs: set `supabase_jwt_secret` (or `SUPABASE_JWT_SECRET`) to accept
tokens issued by your self-hosted Supabase GoTrue; optionally set
`supabase_jwt_aud` (defaults to `authenticated`). When `jwt_secret` is empty,
the Supabase JWT secret is reused for `/auth/login` and wallet challenges so
you only manage a single signing key.
`supabase_gotrue_url` (`SUPABASE_GOTRUE_URL`) is required when `supabase_jwt_secret` is set to enable refresh token proxying and enforce self-hosted GoTrue.
You can also map Supabase roles to admin by setting `supabase_admin_roles`
(`SUPABASE_ADMIN_ROLES=service_role,admin`); any JWT with a matching role
is elevated to `admin` inside the Service Layer.
To derive tenant IDs from JWTs (when `X-Tenant-ID` is not provided), set
`supabase_tenant_claim` (or `SUPABASE_TENANT_CLAIM`) to a claim path such as
`app_metadata.tenant`.
To derive roles from a custom claim, set `supabase_role_claim`
(`SUPABASE_ROLE_CLAIM`, e.g., `app_metadata.role`); admin role mapping is
applied after role extraction.
To enable refresh token proxying for dashboards/CLI, set
`supabase_gotrue_url` (or `SUPABASE_GOTRUE_URL`); `/auth/refresh` will forward
refresh tokens to GoTrue and return the response.

## Auditing
- The HTTP layer keeps a rolling audit buffer (latest 300 entries) in memory alongside persisted rows.
- To persist audits, set `AUDIT_LOG_PATH=/var/log/service-layer-audit.jsonl` (JSONL output). Audits are always written to the `http_audit_log` table in Supabase Postgres.
- Admin-only `/admin/audit?limit=200` returns recent entries; the dashboard Admin panel renders the most recent 20. Admin JWT is required (token-only auth is not admin).

## Security Block

The `security` section holds the AES key used to encrypt secrets at rest. The
`secret_encryption_key` accepts raw, base64, or hex encodings for 16/24/32 byte
keys. When persistence is enabled (Supabase Postgres), this field or the
`SECRET_ENCRYPTION_KEY` environment variable must be set.
