# JAM CLI Enhancement Plan

Goal: make `slctl jam` mirror the hardened JAM API (filters, pagination, metadata) while staying backward compatible with current responses.

## New/Updated Commands
- `slctl jam status` (existing): extend output to show `rate_limit_per_minute`, `max_preimage_bytes`, `max_pending_packages`.
- `slctl jam preimage`
  - `--stat --hash <h>` (existing HEAD)
  - `--meta --hash <h>` (new) to GET JSON metadata.
  - `--file` upload remains.
- `slctl jam packages`
  - Filters: `--status`, `--service`, `--limit`, `--offset`.
  - Handle both envelope (`items`, `next_offset`) and raw array.
  - Optional `--json` to emit raw JSON.
- `slctl jam reports` (new)
  - Filters: `--service`, `--status`, `--limit`, `--offset`.
  - Handle envelope/raw like packages.
- `slctl jam report --package <id>` (existing) unchanged.
- `slctl jam process` unchanged.

## UX Notes
- Default output: pretty-print JSON list; show `next_offset` when present.
- Fail fast on missing required flags (e.g., `--hash` for meta/stat).
- Reuse existing `--addr`, `--token`, `--timeout` flags.

## Error Handling
- Preserve existing error formatting from server; bubble up 4xx/5xx.
- Special-case 404 for preimage meta/stat to print “not found”.

## Implementation Steps
1) Add `jam reports` command and flags.
2) Update `jam packages` to accept filters and envelope.
3) Add `jam preimage --meta` path (GET /jam/preimages/{hash}/meta once available).
4) Extend `jam status` output with new fields when present.
5) Add tests for envelope parsing (unit tests or CLI smoke tests).
