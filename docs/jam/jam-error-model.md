# JAM Error Model

Purpose: standardize error responses for JAM endpoints to make client handling and troubleshooting consistent.

## Goals
- Provide clear, machine-parsable error codes.
- Map codes to HTTP status classes appropriately.
- Keep payload shape consistent across all `/jam/*` endpoints (and admin endpoints later).

## Payload Shape
```json
{
  "error": "human readable message",
  "code": "jam_<namespace>_<detail>"
}
```
- Optional fields:
  - `retry_after` (seconds) for rate limits.
  - `details` (object) for validation errors (e.g., missing fields).

## HTTP → Code Mapping (examples)
- 400 Bad Request: `jam_bad_request`, `jam_validation_error`
- 401 Unauthorized: `jam_auth_missing`
- 403 Forbidden: `jam_auth_forbidden`, `jam_authz_service_denied`
- 404 Not Found: `jam_not_found`
- 409 Conflict: `jam_pending_limit`, `jam_conflict`
- 413 Payload Too Large: `jam_preimage_too_large`
- 429 Too Many Requests: `jam_rate_limit`
- 500/503 Server errors: `jam_internal`, `jam_store_unavailable`

## Namespaces
- `jam_auth` — auth failures.
- `jam_authz` — per-service authorization failures.
- `jam_rate` — rate limiting.
- `jam_quota` — size/pending caps.
- `jam_preimage` — preimage-specific issues.
- `jam_package` — submit/list/process errors.
- `jam_report` — report/attestation errors.
- `jam_admin` — admin endpoints.

## Backward Compatibility
- Existing endpoints currently return `{"error": "..."};` add `code` field (clients should ignore unknown fields).
- Retain existing HTTP statuses; only enrich payload.

## Client Guidance
- Always check HTTP status first.
- Inspect `code` for branch logic; fall back to `error` string for display/logging.
- For 429, honor `Retry-After` header and/or `retry_after` field.

## Implementation Steps
1) Add error helpers in `jam` package to emit `{error, code}` consistently.
2) Update JAM HTTP handler to use helpers across all paths.
3) Update `slctl` to surface `code` in error messages when present.
4) Add tests covering key error paths (auth missing/denied, 429, 413, 409, 404).
