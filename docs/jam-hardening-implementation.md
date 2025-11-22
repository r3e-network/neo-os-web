# JAM Hardening Implementation Plan

Objective: implement the hardened JAM API changes (auth, quotas, filters, metadata, retention) described in `docs/jam-hardened-endpoints.md` without breaking existing prototype clients.

## Workstream Breakdown

### 1) Config + Wiring
- Extend `runtime.jam` with: `auth_required` (bool), `allowed_tokens` ([]string), `rate_limit_per_minute` (int), `max_preimage_bytes` (int64), `max_pending_packages` (int), `retention_days` (int), `legacy_list_response` (bool).
- Normalize defaults; log effective values at startup; surface in `/system/status`.

### 2) Auth & Rate Limiting
- Add middleware in JAM handler to:
  - Enforce bearer auth when `auth_required` is true.
  - If `allowed_tokens` non-empty, require token membership; otherwise reuse global token list.
  - Apply token-level rate limiting (token or IP key) using a leaky bucket in-memory; no-op when disabled.
- Return 401/403 appropriately; 429 with `Retry-After` on limit hit.

### 3) API Enhancements
- Preimages: add `GET /jam/preimages/{hash}/meta` JSON; enforce `max_preimage_bytes` and allowed media types; return 413 on oversized uploads.
- Packages: `GET /jam/packages` accept `status`, `service_id`, `limit`, `offset`; response `{items, next_offset}` unless `legacy_list_response` is true.
- Reports: add `GET /jam/reports` with filters and pagination; optionally `GET /jam/packages/{id}/attestations`.
- Keep existing endpoints compatible; document new responses in `requirements.md`.

### 4) Persistence & Retention
- Add optional retention job:
  - Delete/archive packages/reports older than `retention_days`.
  - Delete preimages unreferenced for `retention_days`.
- Add indexes to support filtered lists:
  - `jam_work_packages(status, service_id, created_at)`
  - `jam_work_reports(service_id, created_at)`
- Enforce `max_pending_packages` on submit; return 409 when exceeded.

### 5) Observability
- Metrics: `jam_preimage_put_total`, `jam_preimage_get_total`, `jam_preimage_bytes`, `jam_package_submit_total`, `jam_package_process_total`, `jam_rate_limit_hits_total`, `jam_quota_reject_total`.
- Logs: structured events for package submit, process success/fail, preimage upload, quota/rate limit hits.
- Status: extend `/system/status` JAM section with store, rate_limit_per_minute, max_preimage_bytes.

### 6) CLI Updates (slctl)
- Support paginated `jam packages`/`jam reports` (`--status`, `--service`, `--limit`, `--offset`).
- Add `jam preimage --meta --hash` to fetch JSON metadata.
- Ensure `jam status` renders new status fields.

### 7) Docs & Tests
- Update `requirements.md` with endpoint schemas, errors, and limits.
- Add handler/CLI tests for auth failures, quota/rate-limit responses, filterable listings, and new meta endpoint.
- Document ops knobs in README / jam design docs.

## Phasing
1) Config + middleware (auth + rate limit) + status surface.
2) API filters/pagination + preimage meta + size cap.
3) DB indexes + max_pending_packages check + retention job (PG only; noop for memory).
4) Metrics/logging + CLI pagination/meta support.
5) Docs/tests sweep and enable by default (auth_required=true, limits set conservatively).

## Open Questions
- Token scoping: do we need per-account/service claims now, or is token allowlist sufficient?
- Retention: default window (e.g., 30 days) acceptable? Should preimages follow a different policy?
- Rate limit key: per token vs per IP vs both?
