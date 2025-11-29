# JAM Testing Plan

Purpose: define a test strategy for the JAM prototype and upcoming hardening work (auth, quotas, listings, retention, observability).

## Test Areas
- **Preimages**
  - Upload success (valid hash, media type).
  - Oversized upload rejected (413) when `max_preimage_bytes` set.
  - HEAD/meta responses (hash/size/media type) for existing/missing blobs.
  - GET streams correct bytes and content type.
- **Packages/Reports**
  - Submit package with/without optional fields; pending status set.
  - Process flow: pending → report + attestations → applied status.
  - Fetch package by id; fetch report by package id.
  - Listing (filters/pagination): status/service/limit/offset; legacy response if enabled.
  - Pending cap enforced (409) when `max_pending_packages` exceeded.
- **Processing**
  - Process returns 204 when queue empty.
  - Error path: refiner/attestor/accumulator failure yields 400 and package marked disputed (if implemented).
- **Auth/Rate Limits (when enabled)**
  - Missing token → 401; disallowed token → 403.
  - Rate limit hit → 429 with Retry-After; subsequent requests within window rejected.
- **Status/Health**
  - `/system/status` exposes JAM fields (enabled, store, limits).
  - (Optional) `/jam/healthz` returns 200 when store reachable.
- **Retention (when enabled)**
  - Cleanup deletes old packages/reports/preimages beyond retention; dry-run mode logs only.
  - Refcount accounting stays non-negative after deletions.
- **CLI (slctl)**
  - `jam preimage` upload/stat/meta happy paths and 404/413 errors.
  - `jam packages` handles envelope and filters; `jam report` displays report+attestations.
  - `jam status` renders JAM fields.
  - `jam process` processes a pending package end-to-end.

## Environments
- **Memory mode**: fast unit/integration tests; note ephemeral storage.
- **Postgres mode**: integration tests using test DB (jam migrations applied).

## Tooling
- Go unit tests in `applications/jam` for model validation, engine, store, handler.
- HTTP handler tests for auth, rate-limit, quota, listing filters.
- CLI tests (lightweight) using httptest server.
- Optional e2e script: start appserver (memory/PG) + run slctl flows.

## Metrics/Logging Verification
- Use Prometheus test registry to assert counters/histograms increment on happy/failed paths.
- Ensure logs do not include raw tokens or blob content.

## Regression Matrix
- Table-driven tests for:
  - auth_required on/off
  - rate_limit enabled/disabled
  - legacy_list_response on/off
  - memory vs postgres store
