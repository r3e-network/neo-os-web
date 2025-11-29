# JAM Service Ownership & AuthZ Design

Purpose: define how to tie JAM operations to service ownership and enforce per-service access controls beyond the global bearer tokens.

## Goals
- Restrict package submission and report inspection to authorized principals for a given service.
- Keep configuration simple (reuse existing auth model) while enabling multi-tenant isolation.
- Remain backwards compatible: opt-in gating when `runtime.jam.authz_enabled` is true.

## Service Ownership Model
- Each JAM service has an `owner` field (already in the data model).
- Ownership can map to:
  - Account ID from existing accounts service, or
  - Arbitrary owner string (e.g., email/team) if not using accounts.
- Optionally allow an owner to register “delegates” (additional tokens) per service.

## AuthZ Policy
- Config:
  - `runtime.jam.authz_enabled` (bool)
  - `runtime.jam.owner_is_account` (bool) — when true, owner must match an account ID.
  - `runtime.jam.service_delegates` (map service_id → []token) or store in DB table for PG.
- Request checks (when authz_enabled):
  - Extract bearer token.
  - If token matches global allowed_tokens, allow (operator override).
  - Else, resolve service owner:
    - If owner_is_account: lookup account and its tokens (reuse secrets/ACL table or config).
    - Else: compare token against service_delegates[service_id].
  - Deny with 403 `{"error":"not authorized","code":"jam_authz"}` on mismatch.
- Scope of enforcement:
  - Package submit (`POST /jam/packages`): token must be authorized for the target service.
  - Package/report fetch and listing with `service_id` filter: token must be authorized for that service.
  - Preimages: open to any authorized JAM token (optional future: tie blobs to services).

## Data Storage (PG path)
- New table (if needed): `jam_service_delegates(service_id UUID, token_hash TEXT, created_at TIMESTAMPTZ, PRIMARY KEY(service_id, token_hash))`.
- Hash tokens before storage (sha256) to avoid plaintext in DB.
- In-memory path: map[service_id][]tokenHash.

## Token Hashing
- Always hash tokens (sha256) for comparison/storage; compare hashed bearer tokens.
- Logging uses token hash prefix (e.g., first 8 chars) for traceability without exposing secrets.

## CLI/User Flow
- Operators can supply `--token` that is either:
  - A global operator token (bypasses per-service authz), or
  - A delegated token for the specific service.
- Future: add a CLI command to register delegates (PG mode) if needed.

## Backward Compatibility
- When `authz_enabled=false`, behaviour matches current prototype (any JAM-enabled token works).
- Global operator tokens (allowed_tokens) always bypass per-service checks for emergency access.

## Implementation Steps
1) Add config fields and token hashing helper.
2) Add optional delegate store (memory + PG) for service_id → token_hash list.
3) Inject authz check into JAM handler:
   - On package submit: validate token against service owner/delegates.
   - On list with service filter and on `/jam/packages/{id}` / `/jam/packages/{id}/report`: enforce authz.
4) Extend `/system/status` to show `authz_enabled`.
5) Add tests: authorized/unauthorized tokens per service, operator bypass, disabled mode.
