# JAM Health & Readiness Design

Purpose: define health/readiness signals for JAM components so operators and orchestrators can detect issues early.

## Goals
- Expose a lightweight health endpoint for JAM stores/executors without leaking sensitive info.
- Integrate health into existing `/system/status` and optionally a dedicated `/jam/healthz`.
- Provide readiness vs liveness semantics for orchestration.

## Signals
- **Store connectivity**:
  - Memory store: always healthy (with a warning that data is ephemeral).
  - Postgres store: `SELECT 1` / ping; fail if migrations missing (jam tables absent).
  - S3 (if enabled): optional HEAD on a known bucket/key or a list-bucket call with short timeout.
- **Cleanup runner** (if retention enabled):
  - Track last run time and last error; unhealthy if stale or failing repeatedly.
- **Rate/Quota config**: not a hard health failure; include in status for observability.

## Endpoints
- `/system/status` (existing):
  - Add `jam.health` block: `{store_ok: bool, cleanup_ok: bool, last_cleanup: timestamp, store: "memory|postgres|s3", enabled: bool}`.
- `/jam/healthz` (new, optional):
  - GET; returns 200 when store is reachable and (if enabled) cleanup runner is not failing; 503 otherwise.
  - No auth required by default? Recommend requiring auth; can be configurable (`runtime.jam.health_public`).

## Readiness vs Liveness
- **Readiness**: store connectivity + migrations present; if failed, return 503 to keep instance out of load balancer.
- **Liveness**: mostly tied to process health; JAM-specific liveness can include cleanup runner not panic-ing.

## Config
- `runtime.jam.health_public` (bool, default false) — whether `/jam/healthz` is unauthenticated.
- `runtime.jam.health_timeout` (duration, default 2s) — per-check timeout.

## Implementation Steps
1) Add health checker in JAM handler that pings store (PG: `db.PingContext`; S3: optional).
2) Track cleanup runner status/last run (if implemented); expose in status.
3) Add `/jam/healthz` route guarded by optional auth; return 200/503 with JSON `{status, details}`.
4) Extend `/system/status` to include JAM health fields.
5) Tests: store down -> 503; migrations missing -> fail; memory store -> always ok; cleanup stale -> cleanup_ok=false.
