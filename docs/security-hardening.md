# Security & Production Hardening Checklist

This repo ships sensible defaults for local compose (`dev-token`, `admin/changeme`). Before exposing a deployment, harden it:

## Authentication & RBAC
- Set strong tokens (`API_TOKENS`) **or** rely solely on JWT (`AUTH_USERS` + `AUTH_JWT_SECRET`). Remove `dev-token` and `admin/changeme`.
- If using Supabase GoTrue, set `SUPABASE_JWT_SECRET` (and optional `SUPABASE_JWT_AUD`) and map trusted roles to admin with `SUPABASE_ADMIN_ROLES` (e.g., `service_role,admin`). Limit admin roles to a minimal set.
- When Supabase JWTs are enabled, set `SUPABASE_GOTRUE_URL` so `/auth/refresh` proxies refresh tokens against your self-hosted GoTrue; do not point it at a hosted/shared instance. Treat refresh tokens as highly sensitive secrets.
- Prefer storing refresh tokens in session storage (dashboard) or short-lived env vars (CLI) and avoid long-lived persistence. Clear refresh tokens on logout/clear-session actions.
- `DATABASE_URL` is required (Supabase Postgres); empty/missing DSNs must fail startup. Keep the database inside a private network and enforce TLS (`sslmode=require`).
- Enforce admin-only workflows with JWTs; token-only auth should not be treated as admin.
- `/system/events|data|compute` fan-out endpoints are admin-only; keep admin tokens/JWT roles tightly scoped.
- Prefer per-tenant JWTs (role + tenant claims) and ensure the gateway propagates tenant (via `X-Tenant-ID`) and role consistently. Tenant-tagged accounts and resources require the correct tenant header; listings without a tenant only return unscoped accounts, preventing cross-tenant leakage.
- Set `REQUIRE_TENANT_HEADER=true` in production to reject authenticated requests that omit the tenant header (auth/login/refresh stay public).
- Disallow query-string tokens; use the `Authorization: Bearer` header only. Avoid embedding tokens in links or logs.

## Transport & Edge
- Terminate TLS at a trusted reverse proxy (nginx/envoy/ALB) with modern ciphersuites.
- Strip untrusted `X-Forwarded-For`/`X-Forwarded-Proto` headers at the edge; inject canonical values once.
- Enable rate limiting and request size limits at the proxy for `/accounts/*`, `/auth/*`, and `/admin/*`.
- Cap bus payload sizes: set `BUS_MAX_BYTES` (default 1 MiB) to bound `/system/events|data|compute` bodies and align proxy limits accordingly.

## Secrets & Storage
- Store secrets outside the repo: `.env` is for local use only. Use environment or secret managers (Vault/SSM/KMS) for `AUTH_JWT_SECRET`, `SECRET_ENCRYPTION_KEY`, DB credentials, and API tokens.
- Enable AES-GCM for the secret vault (`SECRET_ENCRYPTION_KEY`) when using PostgreSQL.
- Configure Postgres with TLS at rest/in transit where supported; restrict network access to trusted subnets.
- Set `RANDOM_SIGNING_KEY` to a persistent ed25519 private key so randomness signatures remain stable across restarts; ephemeral keys degrade verifiability.

## Auditing & Logging
- Enable persistent audit logging: set `AUDIT_LOG_PATH` or rely on Postgres (`http_audit_log`).
- Centralize logs (e.g., to CloudWatch/ELK) and alert on 4xx/5xx spikes, repeated auth failures, and admin actions.

## CI/CD & Branch Protection
- Require `dashboard-typecheck` and Go test jobs before merge.
- Sign container images or verify digests at deploy time.

## Runtime Flags & Health
- Keep `/healthz` minimal; protect `/admin/*` and `/metrics` behind auth/firewall.
- Use resource limits on containers (CPU/mem) and configure Postgres pool sizes (`max_open_conns`, `max_idle_conns`).

## Data Integrity
- Run DB migrations in a controlled pipeline (not at random on prod nodes). Back up the database before major upgrades.
- Monitor failed migrations and schema drift.

## Observability
- Enable Prometheus scraping on `/metrics`; restrict access via network policy or auth proxy.
- Dashboards should point to Prometheus behind auth; avoid exposing PromQL endpoints publicly.

## Disaster Recovery
- Configure regular DB backups and test restores.
- Document runbooks for restarting the stack (`make down && make run` for local; use orchestrator scripts for prod).

## Frontend/Dashboard
- Set `VITE_*`/CSP headers at the proxy to pin API origins and disallow mixed content.
- Avoid shipping default tokens in production builds; bake API base via env or use a settings service with auth.

Refer back to `docs/requirements.md` for the source of truth on behaviour and update it when changing auth, storage, or admin flows.
