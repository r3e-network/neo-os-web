# Quadratic Funding deployment status

Verified again through read-only Neo RPC calls at `2026-07-11T06:48:30Z`. No wallet key was loaded, no transaction was sent, and no contract was deployed or updated.

## Configured contract

`0xe2fba2a73cf92874ecc41b7fff8d3d5da0354c43`

| Network | Network magic | Contract state | Read results | Recovery capability |
| --- | ---: | --- | --- | --- |
| Neo N3 TestNet T5 | `894710606` | present, `updatecounter: 0`, `isPaused: false` | `totalRounds: 31`, `totalProjects: 30` | `directAssetCreditOf/2` faults: method not found |
| Neo N3 MainNet | `860833102` | present, `updatecounter: 0`, `isPaused: false` | `totalRounds: 1`, `totalProjects: 1` | `directAssetCreditOf/2` faults: method not found |

The deployed ABI contains the core round/project/contribution/finalization/claim methods, but it predates the current source artifact's direct-asset credit read/reclaim methods and later refund/reclaim lifecycle methods.

## Frontend behavior

- Round and project reads remain available.
- All contract writes are fail-closed when the recovery probe is missing, the app-local or external PauseRegistry state is paused, or the snapshot is unavailable; round and project reads remain available.
- A capability probe never enables writes by itself. The exact `network:contract:code-fingerprint` must be explicitly approved after the signed checklist passes; the current production build approves none. A script hash alone is insufficient because Neo contract upgrades retain the address.
- Supported writes require the exact transaction-scoped contract event and a matching chain readback before success is shown.
- The match preview is explicitly an aggregate estimate, not exact per-donor CLR and not Sybil-resistant identity proof.

## Required before enabling funding writes

1. Review and build the current `MiniAppQuadraticFunding` source and manifest.
2. Add a safe `deploymentFingerprint` read backed by the actual deployed NEF checksum/update identity, plus an app-level reclaim event and a user-facing `reclaimDirectAssetCredit` flow with durable deposit/action journaling. The journal must receive the deposit txid at broadcast time, verify durable-storage round trips, and use a cross-tab lease/storage synchronization so private/sandboxed hosts or two tabs cannot lose or overwrite it. Also expose and verify sponsor cancellation refunds and the 90-day contributor/unclaimed-match recovery paths; do not approve a deployment while these recovery actions remain CLI-only.
3. Deploy/update independently on TestNet; do not reuse a mainnet decision from testnet evidence.
4. Verify `directAssetCreditOf` and `reclaimDirectAssetCredit` on the deployed ABI.
5. Execute TestNet lifecycle scenarios with distinct creator, donor, project-owner, and platform-admin wallets:
   - prepaid deposit + create success;
   - prepaid deposit + forced consume failure + exact credit reclaim;
   - project registration and contribution window boundaries;
   - owner/creator self-contribution rejection;
   - admin-only finalization after round end;
   - contribution-only and contribution+match claims;
   - cancellation/refunds, unused matching, and 90-day unclaimed-funds recovery;
   - event payload and post-write readback equality.
6. Add the exact validated `network:contract:code-fingerprint` to the frontend approval set and update `neo-manifest.json` deployment evidence only after those writes are confirmed.

The in-repo source/artifact is not treated as proof that either configured network has been upgraded.
