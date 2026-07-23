# Shared AA Upgrade Preflight

Generated: 2026-07-22T23:47:25.517Z

Phase: **upgrade_contracts**
Safe to materialize: **NO**
Next action: `upgrade_aa_then_registry_and_rerun_preflight`

Reason: live contracts do not expose the reciprocal shared-AA configuration ABI

## AA Upgrade Governance

- Live route: `legacy_direct`.
- Boundary: The current live AA core has no proposeUpdate method. Its one-time bootstrap to the local artifact is a direct admin update; the local artifact makes subsequent upgrades seven-day timelocked.
- Exact local-artifact simulation: `HALT`; no transaction was created.
- Non-admin control simulation: `FAULT` (must remain FAULT).
- Upgrade compatibility: `conditional`.
- Exact live source revision known: **NO**.
- Candidate ABI removals: `transferAdmin(Hash160):Void:write`.
- Changed existing storage prefixes: 0.
- Changed stored-record layouts: 0.
- Provenance boundary: The tracked historical manifest is a semantic proxy for the live ABI, not exact deployed-source provenance; compatibility remains conditional on the recorded ABI and storage invariants.

## Required Order

1. review and execute the current AA governance route, then verify the exact on-chain ABI/checksum
2. upgrade PlatformRegistry with abstractAccountCore still disabled
3. propose then confirm PlatformRegistry as AA platform registrar
4. propose then set UnifiedSmartWallet as Registry abstract-account core
5. run the 77-app materialization dry-run and verify uniqueness/reverse indexes
6. broadcast materialization only under a separately reviewed write authorization

## Rollback Boundary

- Before activation: cancel either pending registrar/core proposal.
- After activation: propose zero Registry core, wait 24 hours, then set it; existing identities remain indexed.
- Registrar rotation: do not rotate away from Registry until Registry core is disabled.
- This preflight made no chain writes and is not authorization to sign or broadcast.
