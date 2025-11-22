# JAM Attestations, Consensus, and Disputes (Design Notes)

This doc proposes how to handle attestation thresholds, dispute resolution, and incentives for the JAM prototype as it hardens.

## Goals
- Define quorum rules for accepting WorkReports.
- Provide a path for detecting and resolving disputes.
- Outline incentives/slashing for attestors (future).
- Keep initial implementation simple and configurable.

## Attestation Model
- Each WorkReport includes zero or more attestations: `{report_id, worker_id, signature, weight, created_at, engine, engine_version}`.
- Threshold-based acceptance:
  - Configurable `attestation_threshold` (sum of weights).
  - Once cumulative weight ≥ threshold, the report is eligible for `accumulate`.
- Multiple reports per package:
  - If a new report arrives for the same package with a different `RefineOutputHash`, mark package as disputed and halt apply until resolved.

## Dispute Handling
- Triggers:
  - Conflicting reports for the same package.
  - Explicit admin flag (`POST /jam/disputes/{report_id}`) if added later.
- Resolution options:
  1. **Re-run refiner deterministically** with a trusted worker set; if output matches one report, accept that one and reject others.
  2. **Manual override** (admin) to pick a report or mark package failed.
- Outcomes:
  - Accepted report: proceed to `accumulate`.
  - Rejected report: mark as disputed/failed, optionally decrement reputation/weight for offending attestors.
- Timeouts:
  - Optional `dispute_timeout` after which a default decision is applied (e.g., reject all).

## Incentives (Future)
- Attestor registry with stake/balance.
- Slashing on bad attestations:
  - If an attestor signs a report that later proves invalid, slash stake.
  - Require stake ≥ weight to prevent infinite weight from unstaked actors.
- Rewards:
  - Pay attestors per accepted report, proportional to weight.
- Reputation:
  - Track success/failure counts; adjust effective weight over time.

## Config Surface (proposed)
- `attestation_threshold` (int/weight)
- `dispute_timeout` (duration, optional)
- `allow_conflicting_reports` (bool; default false = auto-dispute)
- `attestor_registry` toggle (future)

## Storage Changes (optional, future)
- `jam_attestors` table: `{id, stake, reputation, weight_override, created_at, updated_at}`
- `jam_disputes` table: `{package_id, report_ids[], status, resolution, created_at, resolved_at}`

## API Hooks (future)
- `POST /jam/reports/{id}/attest` (already implicit via report save)
- `POST /jam/disputes/{report_id}` (admin)
- `GET /jam/disputes/{package_id}` (inspect)

## Minimal Implementation Path
1. Accept attestations and enforce a simple weight threshold.
2. Detect conflicting reports for the same package and mark as disputed; block accumulate.
3. Add a “resolve by re-run” hook (admin/manual) to select a report.
4. Defer staking/rewards to a later phase once the pipeline is stable.
