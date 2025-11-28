# JAM Admin & Control Plane Design

Purpose: define administrative controls for JAM beyond the public operator endpoints (e.g., dispute resolution, delegate token management, cleanup triggers, and feature toggles).

## Goals
- Provide a small set of admin-only endpoints/commands to manage JAM state.
- Keep blast radius low; require explicit admin tokens and/or IP allowlist.
- Avoid coupling to existing account model unless enabled.

## Admin Auth
- Separate token list: `runtime.jam.admin_tokens` (hash in config or env).
- Optional IP allowlist: `runtime.jam.admin_allow_ips`.
- Admin endpoints always require admin token; regular JAM tokens cannot access.

## Proposed Admin Endpoints
- **Disputes**
  - `POST /jam/admin/disputes/{package_id}/accept` with body `{report_id:"..."}` — pick a report to accept and proceed to accumulate.
  - `POST /jam/admin/disputes/{package_id}/reject` — mark disputed/failed.
  - `GET /jam/admin/disputes/{package_id}` — inspect conflicting reports/attestations.
- **Delegates (if per-service authz enabled)**
  - `POST /jam/admin/services/{id}/delegates` body `{token:"..."}` — add delegate (stored as hash).
  - `DELETE /jam/admin/services/{id}/delegates/{token_hash}` — remove delegate.
  - `GET /jam/admin/services/{id}/delegates` — list token hashes (never raw tokens).
- **Cleanup**
  - `POST /jam/admin/cleanup/run` — trigger retention cleanup now (PG only).
  - `GET /jam/admin/cleanup/status` — last run time/results.
- **Feature Toggles (optional)**
  - `POST /jam/admin/toggles` body `{enabled: bool, rate_limit_per_minute: int, max_preimage_bytes: int64, max_pending_packages: int}` — adjust runtime without restart (persisted; no in-memory overrides).
  - `GET /jam/admin/toggles` — current overrides.

## Response/Errors
- Standard admin error envelope: `{"error":"...","code":"jam_admin_<code>"}` with 401/403 on auth failures.
- Log admin actions (with token hash) for audit.

## CLI Support (slctl)
- `slctl jam admin disputes --package <id> --accept <report>|--reject`
- `slctl jam admin delegates --service <id> add|list|delete`
- `slctl jam admin cleanup run|status`
- `slctl jam admin toggles set|get`
- Require separate admin token flag (e.g., `--admin-token` or reuse `--token`).

## Persistence (PG)
- Delegates table: `jam_service_delegates(service_id UUID, token_hash TEXT, created_at TIMESTAMPTZ, PRIMARY KEY(service_id, token_hash))`.
- Disputes table (optional): `jam_disputes(package_id UUID, status TEXT, chosen_report UUID, created_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ)`.
- Cleanup status table (optional) or reuse logs/metrics.

## Safety Considerations
- Admin endpoints should not be mounted unless `jam.admin_tokens` is set.
- Rate-limit admin endpoints separately to avoid abuse.
- Mask all tokens in logs; store hashes only.

## Implementation Steps
1) Add admin config (tokens, allow_ips).
2) Add middleware for admin auth; mount admin mux under `/jam/admin/*` only when admin tokens set.
3) Implement disputes and delegate endpoints (PG + memory stubs).
4) Add cleanup trigger/status endpoints (PG only).
5) Add CLI commands for admin operations.
6) Tests for auth gating and admin actions; update docs.
