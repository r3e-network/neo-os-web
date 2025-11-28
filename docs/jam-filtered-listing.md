# JAM Filtered Listing & Pagination Design

Purpose: add filters and pagination to JAM list endpoints while keeping backward compatibility for existing clients.

## Endpoints
- `GET /jam/packages`
- `GET /jam/reports` (new)

## Query Parameters
- `status`: `pending|applied|disputed` (packages), `applied|disputed` (reports if tracked)
- `service_id`: filter by service
- `limit`: max items to return (default 50, max 200)
- `offset`: numeric offset for simple pagination (prototype)
- Future: cursor-based pagination if needed.

## Response Shape
- Default (new): envelope
  ```json
  {
    "items": [...],
    "next_offset": 100
  }
  ```
- Legacy mode: raw array when `runtime.jam.legacy_list_response=true`.
- `next_offset` is null when no more data.

## Store Requirements
- **Supabase store**: filter in Postgres; offset/limit slicing.
- **Postgres store**:
  - Add indexes: `jam_work_packages(status, service_id, created_at)` and `jam_work_reports(service_id, created_at)`.
  - Queries use `ORDER BY created_at DESC LIMIT $limit OFFSET $offset`.

## CLI Changes
- `slctl jam packages --status ... --service ... --limit ... --offset ...`
- `slctl jam reports --service ... --limit ... --offset ...`
- When envelope present, render items and show `next_offset`.

## Error Handling
- Invalid status → 400 `{"error":"invalid status","code":"jam_bad_request"}`
- Limit > max → clamp to max.

## Backward Compatibility
- Legacy flag preserves array responses.
- Existing `slctl jam packages` works, receiving the envelope; CLI updated to handle both shapes.

## Implementation Steps
1) Extend store interfaces to support filtered list; update memory/PG stores with filters and offset/limit.
2) Update HTTP handler to parse query params and return envelope or legacy.
3) Add indexes to PG migration for filtering/pagination.
4) Update CLI to accept filters and handle envelope.
5) Add tests for filtered queries (memory) and response shapes.
