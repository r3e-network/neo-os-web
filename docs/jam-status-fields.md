# JAM Status Fields

`/system/status` includes a `jam` object when the JAM API is enabled. Fields:
- `enabled` — whether JAM endpoints are mounted.
- `store` — `memory` or `postgres`.
- `rate_limit_per_min` — per-token rate limit.
- `max_preimage_bytes` — max upload size.
- `max_pending_packages` — pending queue cap before rejecting new packages.
- `auth_required` — whether bearer auth is enforced.
- `legacy_list_response` — true when legacy list shapes are returned.
- `accumulators_enabled` — whether accumulator/receipt plumbing is active.
- `accumulator_hash` — hash function used for roots (e.g., `blake3-256`).
- `accumulator_roots` — when enabled, array of `{service_id, seq, root, updated_at}`.
