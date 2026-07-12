# Milestone Escrow Neo N3 TestNet status

Verified: 2026-07-11 (read-only; no wallet transaction)

## Deployment

| Field | Result |
|---|---|
| RPC nodes | `testnet1.neo.coz.io`, `testnet2.neo.coz.io` |
| Contract | `0x442162de25008ac78d4cce62ed8d8a64401b7ece` |
| Name | `MiniAppMilestoneEscrow` |
| NEF checksum | `447355561` |
| ABI methods | 28 |
| `isPaused` | `HALT`, `false` |
| `getPlatformStats` | `HALT` |
| `getEscrowDetails(29)` | `HALT`, complete project/tranche map |

`getPlatformStats` returned:

- `totalEscrows = 29`
- `totalLocked = 300000000`
- `totalReleased = 280000000`
- `minNeo = 1`
- `minGas = 10000000` (0.1 GAS)
- `minMilestones = 1`
- `maxMilestones = 12`

## ABI result

Present: `createEscrow`, `approveMilestone`, `claimMilestone`, `cancelEscrow`, `getEscrowDetails`, `getMilestoneDetails`, `getCreatorEscrows`, and `getBeneficiaryEscrows`.

Missing: `directAssetCreditOf`, `reclaimDirectAssetCredit`, and `reclaimApprovedMilestone`. Direct `directAssetCreditOf` invocation returns `FAULT` on both TestNet RPC nodes.

## Product decision

TestNet is browseable and existing escrows can still be approved, claimed, or cancelled. New escrow creation is disabled before the deposit step because the current contract cannot withdraw a deposit that confirms while `createEscrow` does not complete.

This is a contract deployment prerequisite, not a frontend test failure. No deployment or transaction was authorized for this pass.

