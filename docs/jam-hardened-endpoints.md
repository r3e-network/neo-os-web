# JAM Hardened Endpoints (Proposed)

This design doc proposes concrete API changes to harden the JAM prototype endpoints with auth scopes, quotas, filters/pagination, and richer metadata surfaces.

## Goals
- Guard `/jam/*` with scopes and rate limits.
- Add filters/pagination to package/report listings.
- Provide JSON metadata for preimages.
- Enforce size/type limits and retention for artifacts.
- Keep backward compatibility where possible (prototype clients still work with minimal changes).

## AuthN/AuthZ
- Reuse bearer tokens; add optional JAM scope flag:
  - Config: `runtime.jam.auth_required` (default true when enabled), `runtime.jam.allowed_tokens` (whitelist), fallback to existing tokens when unset.
  - Request: require `Authorization: Bearer <token>`; return 403 if JAM scope not allowed.
- Ownership (optional, phase 2):
  - Accept optional `service_owner` on packages; enforce token claim/metadata if provided.

## Rate Limits & Quotas
- Config (per node):
  - `runtime.jam.rate_limit_per_minute` (default 60)
  - `runtime.jam.max_preimage_bytes` (default 10 MiB)
  - `runtime.jam.max_pending_packages` (default 100)
- Enforcement:
  - 429 on rate limit; `Retry-After` header.
  - 413 on preimage too large.
  - 409 on exceeding pending package cap.

## API Changes

### Preimages
- Add `GET /jam/preimages/{hash}/meta` → JSON:
  ```json
  {"hash":"...", "size":123, "media_type":"text/plain", "created_at":"...", "uploader":"..."}
  ```
- Keep `PUT/GET/HEAD` semantics; enforce max size/media types.
- Optional: `DELETE /jam/preimages/{hash}` (admin only) to drop blobs past retention.

### Packages
- `GET /jam/packages` gains filters/pagination:
  - Query params: `status=pending|applied|disputed`, `service_id=<id>`, `limit`, `offset`.
  - Response: `{ "items": [...], "next_offset": <int|null> }`.
- `GET /jam/packages/{id}` unchanged.
- Add `GET /jam/packages/{id}/attestations` (or extend report response with `attestations` only mode).

### Reports
- `GET /jam/reports`:
  - Filters: `service_id`, `status` (if we track apply/dispute), `limit`, `offset`.
  - Payload: list of reports (without attestations) plus pagination token.
- `GET /jam/packages/{id}/report` unchanged.

### Processing
- `POST /jam/process` unchanged for now; later we can add `?limit=N` to process multiple pending packages in one call (idempotent batches).

### Errors
- Standardize error payload: `{"error":"message","code":"jam_<code>"}`; 4xx for client issues, 5xx for server.

## Persistence & Retention
- Preimage caps: reject uploads > `max_preimage_bytes`.
- Retention job (cron/ticker):
  - Purge packages/reports older than `runtime.jam.retention_days` (soft delete or archive flag).
  - Optionally purge preimages unreferenced for `retention_days`.
- DB indexes:
  - `jam_work_packages(status, service_id, created_at)`
  - `jam_work_reports(service_id, created_at)`

## Observability
- Metrics:
  - `jam_preimage_put_total`, `jam_preimage_get_total`, `jam_preimage_size_bytes`
  - `jam_package_submit_total`, `jam_package_process_total`, `jam_package_process_fail_total`
  - `jam_attestations_total`, `jam_rate_limit_hits_total`
- Logs: structured entries for submit/process/report with package_id/service_id/store.
- `/system/status` already carries `jam.enabled/store`; add `jam.rate_limit`, `jam.max_preimage_bytes` optionally.

## Backward Compatibility
- Existing clients (slctl) continue to work; listings will start returning paginated envelope (`items`, `next_offset`). Add a transitional flag `jam.legacy_list_response` (default false) if needed.
- Preimage `PUT/GET/HEAD` unchanged; new meta endpoint is additive.

## Rollout Steps
1) Extend config structs for auth/limits/retention; wire defaults.
2) Add middleware for auth scope + rate limiting on `/jam/*`.
3) Implement filters/pagination in list endpoints; adjust slctl to consume `items`.
4) Add preimage meta JSON endpoint; enforce size/media caps.
5) Add retention job (Supabase: soft-delete or delete).
6) Add metrics/logging; expose in Prometheus and logs.
7) Update `requirements.md` and `slctl` help text.
