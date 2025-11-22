# JAM Accumulator & Receipt Implementation Plan

## Goal
Add accumulator-backed receipts for JAM packages/reports so clients can verify ordering and inclusion without changing existing APIs for legacy consumers.

## Scope
- Per service-id accumulator root updated on each accepted package/report.
- Receipts that link hash → seq → prev/new root with timestamp and status.
- Expose roots/receipts via status endpoints and optional response envelopes.
- Storage: PostgreSQL first; memory store keeps in-process chain only.
- Keep legacy list responses and behaviour unchanged by default.

## Non-Goals (for now)
- Cross-service aggregate roots or light-client proofs.
- DAS/erasure coding; single-region storage suffices initially.
- Economic incentives or external consensus.

## Data Model (PostgreSQL)
- `jam_accumulators`: `service_id PK`, `seq BIGINT`, `root BYTEA`, `updated_at`.
  - Root computed as `H(root_prev || entry_type || hash || metadata_hash || seq || timestamp)`.
  - `entry_type` ∈ {package, report} to keep domains distinct in the chain.
- `jam_receipts`: `hash PK`, `service_id`, `entry_type`, `seq`, `prev_root`, `new_root`, `status`, `processed_at`, `metadata_hash`, `extra JSONB`.
  - Foreign-key to `jam_accumulators.service_id` on update; indexed by `service_id, seq` and `service_id, hash`.
- Existing `packages`/`reports` tables gain optional `seq` and `receipt_root` columns for quick joins.
- Memory store mirrors the fields in structs; persistence only in-process.

## API Changes
- **Status** (`/system/status`): add `jam.accumulator_roots` map `{service_id: {seq, root}}`; include `accumulator_hash_fn`.
- **Packages**:
  - Query param `include_receipt=true` to return `{receipt: {...}}` alongside package.
  - `legacy_list_response` remains default; envelopes already supported.
- **Reports**: same `include_receipt` and envelope shape.
- **Receipts endpoint**: `GET /jam/receipts/{hash}` returns receipt if stored (auth/rate-limited). Consider later: list/paginate with `service_id`, `limit`, `offset`.
- **CLI (`slctl`)**:
  - `jam status` prints accumulator roots when present.
  - `jam packages --include-receipt`, `jam reports --include-receipt` to surface roots/seq.
  - `jam receipt <hash>` to fetch a specific receipt.

## Processing Flow (PostgreSQL)
1. Validate package/report as today (auth, rate/size, pending caps).
2. Start transaction:
   - Lock accumulator row for `service_id` (create if missing with seq=0, root=zero).
   - Compute `seq = prev_seq + 1`, `prev_root`, `new_root`.
   - Insert receipt row with computed fields.
   - Insert/update package/report row including `seq` and `receipt_root=new_root`.
   - Update accumulator row to `seq/new_root`.
3. Commit; respond with receipt if requested.

## Hashing & Encoding
- Default hash: BLAKE3-256 (matches JAM hashing); hex-encoded in JSON.
- `metadata_hash` derived from canonical JSON of the envelope (deterministic key order, lowercase keys).
- `timestamp` in UTC RFC3339; `seq` monotonic per service-id.

## Concurrency & Integrity
- Use `FOR UPDATE` on `jam_accumulators` to serialize per service-id.
- Unique index on `(service_id, seq)` and `(hash)` in receipts to prevent duplicate seq.
- Idempotent replays: if same hash arrives with matching fields, return existing receipt.

## Migration Plan
- Add tables/columns via new migration; default roots empty.
- Optional backfill job to compute seq/root over existing package/report history per service-id; store receipts with status `backfilled=true` in `extra`.
- Enable feature with config flag `JAM.AccumulatorsEnabled` (default off); status reports availability.
- Rollout per environment; monitor latency/lock contention.

## Observability
- Metrics: accumulator update latency, failures, lock wait time, seq per service-id.
- Logs: receipt creation with seq/root; backfill progress.
- Status: expose `accumulator_roots` and `accumulators_enabled` boolean.

## Testing
- Unit: hash canonicalization, receipt creation idempotency, sequence monotonicity.
- Integration (PG): concurrent writes per service-id, backfill correctness, include_receipt responses.
- CLI: parsing/display of roots and receipts.

## Open Questions
- Should we store both package and report entries in a single chain or separate chains per type? (Plan: single chain with entry_type tag.)
- Do we need pagination/filtering on receipts endpoint? (Likely add `?service_id=&limit=&offset=` later.)
- Should memory store persist accumulator state between restarts? (Out of scope; consider file snapshot if needed.)
