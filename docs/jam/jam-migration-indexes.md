# JAM Database Index Plan

Purpose: ensure Postgres performance for JAM listings and cleanup with proper indexes.

## Existing Tables (from 0019_jam.sql)
- `jam_work_packages`
- `jam_work_items`
- `jam_work_reports`
- `jam_attestations`
- `jam_messages`
- `jam_preimages`

## Proposed Indexes
- Packages:
  - `CREATE INDEX idx_jam_work_packages_status_created ON jam_work_packages(status, created_at DESC);`
  - `CREATE INDEX idx_jam_work_packages_service_created ON jam_work_packages(service_id, created_at DESC);`
- Reports:
  - `CREATE INDEX idx_jam_work_reports_service_created ON jam_work_reports(service_id, created_at DESC);`
- Preimages:
  - `CREATE INDEX idx_jam_preimages_created_refcount ON jam_preimages(created_at, refcount);`
- Attestations:
  - (Optional) `CREATE INDEX idx_jam_attestations_report ON jam_attestations(report_id);`

## Rationale
- Support filtered/paginated listings by status/service and recency.
- Speed up retention/cleanup scans on created_at and refcount.
- Minimal write overhead; aligns with expected query patterns in JAM handlers.

## Migration
- Add a new migration file (e.g., `0020_jam_indexes.sql`) with `CREATE INDEX IF NOT EXISTS ...`.
- Safe for re-run; no schema changes beyond indexes.
