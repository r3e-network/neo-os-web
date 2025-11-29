# JAM Threat Model & Mitigations

This document identifies key threats for the JAM prototype and proposes mitigations to guide hardening work.

## Assets
- Preimages (code/data blobs), WorkPackages, WorkReports/attestations, service state.
- Execution resources (compute time for refine/accumulate).
- Availability of `/jam/*` endpoints and underlying stores (DB/S3).

## Threats & Mitigations

### Unauthorized Access
- **Threat**: Unauthenticated or unauthorized clients submit packages or fetch reports/preimages.
- **Mitigations**:
  - Require bearer auth on `/jam/*` (`auth_required`), allowlist tokens (`allowed_tokens`).
  - Per-service authz (owner/delegates) for submit/list/report when `authz_enabled`.
  - Admin endpoints gated by separate admin tokens/IP allowlist.

### DoS / Resource Exhaustion
- **Threat**: Flooding endpoints to exhaust CPU/DB/object store.
- **Mitigations**:
  - Per-token rate limiting (`rate_limit_per_minute`).
  - Quotas: `max_preimage_bytes`, `max_pending_packages`.
  - Limit refine/accumulate budgets; enforce time/gas caps.
  - Size caps on payloads; early reject oversized uploads with 413.
  - Pagination limits (`limit` with sane max).

### Storage Bloat
- **Threat**: Unbounded preimage/package/report growth.
- **Mitigations**:
  - Retention/cleanup job with `retention_days`.
  - Preimage refcounting and deletion of unreferenced blobs.
  - Optional S3 offload for large blobs; size caps.

### Data Exfiltration
- **Threat**: Leaking preimages/reports to unauthorized users.
- **Mitigations**:
  - Auth/authz checks on GET/HEAD/meta/report endpoints.
  - Avoid logging blob contents; hash tokens in logs.

### Integrity / Tampering
- **Threat**: Modified payloads or invalid hashes.
- **Mitigations**:
  - Hash verification on preimage PUT; refuse mismatches.
  - WorkPackage/Report validation; signed attestations.
  - Include engine/version in report hash to prevent replay after upgrades.

### Conflicting Reports / Wrong State
- **Threat**: Conflicting WorkReports applied, corrupting state.
- **Mitigations**:
  - Attestation threshold before accumulate.
  - Detect conflicting reports per package; mark disputed; block apply until resolved.
  - Admin/manual dispute resolution hook.

### Abuse of Admin Controls
- **Threat**: Malicious use of admin endpoints to accept bad reports, remove delegates, or disable quotas.
- **Mitigations**:
  - Separate admin tokens; IP allowlist; rate limit admin routes.
  - Audit logs for admin actions with token hash.

### Supply-Chain / VM Escape
- **Threat**: Malicious refine/accumulate code escaping sandbox.
- **Mitigations**:
  - Deterministic sandbox (Wasm/RISC-V) with restricted host functions.
  - No filesystem/network access in sandbox; metered execution.
  - Keep engine patched and versioned.

### Object Store Misuse (S3 mode)
- **Threat**: Unauthorized access to bucket; stale data; inconsistent hashes.
- **Mitigations**:
  - IAM/bucket policies for server-only access.
  - Hash verification before/after upload; keep metadata in DB.
  - Background verifier/migrator; timeouts and retries on S3.

## Monitoring/Detection
- Metrics for rate-limit hits, quota rejects, process failures.
- Logs for auth failures, conflicts/disputes, admin actions.
- Alerts on elevated 4xx/5xx, growing pending queue, cleanup failures.

## Residual Risks
- In-memory mode is inherently ephemeral and more DoS-prone.
- Single-process rate limiting; distributed rate limiting would require centralized store.
- Attestation incentives/slashing not implemented yet; relies on honest workers/operators.
