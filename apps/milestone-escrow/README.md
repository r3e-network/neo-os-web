# Milestone Escrow

A Neo N3 escrow workbench for funding a project once and releasing NEO or GAS milestone by milestone.

## Production flow

1. The creator chooses NEO or GAS, a checksum-valid beneficiary address, and 1–12 positive tranches.
2. Creation uses two wallet signatures: the token deposit, then `createEscrow` after that deposit is confirmed.
3. The creator accepts a specific milestone on-chain with `approveMilestone`.
4. The beneficiary claims that exact approved tranche with `claimMilestone`.
5. The creator can cancel only while no approved-but-unclaimed milestone exists. Only the remaining balance is refunded.
6. Before every write the frontend verifies the exact contract address, business limits, and pause state. Before a new deposit it also requires a withdrawal-capable prepaid-credit API.

Every write is treated as successful only after the matching contract event and its escrow/milestone values are verified. A transaction hash without that exact event remains pending and does not mutate the UI.

## Important product limits

- The deployed contract stores tranche amounts, approvals, claims, parties, title, and notes.
- It does **not** store delivery files or evidence and has no dispute arbiter. Parties must exchange evidence and resolve disputes off-chain before approval.
- Milestones cannot be edited after creation.
- NEO is indivisible; GAS uses 8 decimals. The minimum total is 1 NEO or 0.1 GAS.
- There is no platform fee, but normal network fees apply.
- The current 28-method mainnet/testnet deployment does not expose prepaid-credit withdrawal. New escrow creation is therefore fail-closed in the frontend; existing approve, claim, and cancel operations remain available after the core capability check passes.
- The local recovery-capable contract build adds `directAssetCreditOf`, `reclaimDirectAssetCredit`, and a 30-day `reclaimApprovedMilestone`, but those paths must not be advertised as live until a deployment update is completed and verified.
- Broadcast writes are persisted on-device and remain visibly pending until an exact event or contract-state readback proves the outcome.

## Contract interface used by the app

- `createEscrow(creator, beneficiary, asset, totalAmount, milestoneAmounts, title, notes)`
- `approveMilestone(creator, escrowId, milestoneIndex)`
- `claimMilestone(beneficiary, escrowId, milestoneIndex)`
- `cancelEscrow(creator, escrowId)`
- `getEscrowDetails(escrowId)`
- `getCreatorEscrows(creator, offset, limit)`
- `getBeneficiaryEscrows(beneficiary, offset, limit)`

The UI converts its zero-based milestone selection to the contract's one-based index.

## Network status

| Network | Contract | Status |
|---|---|---|
| Neo N3 Mainnet | `0x442162de25008ac78d4cce62ed8d8a64401b7ece` | Deployed |
| Neo N3 Testnet | `0x442162de25008ac78d4cce62ed8d8a64401b7ece` | Deployed |

Read-only RPC validation on 2026-07-11 confirmed that both networks return `HALT` for `getPlatformStats`, report the expected limits (`1 NEO`, `0.1 GAS`, `1–12` milestones), and expose the 28-method create/approve/claim/cancel ABI. Repeated checks through `testnet1`, `testnet2`, `mainnet1`, and `mainnet2` found no `directAssetCreditOf`, `reclaimDirectAssetCredit`, or `reclaimApprovedMilestone`; a direct recovery probe returns `FAULT`. Both deployments report NEF checksum `447355561`.

Because that live build cannot recover an unconsumed two-step deposit, the frontend treats it as a legacy deployment: it permits recovery-critical operations on existing escrows (approve/claim/cancel) but refuses to request a new deposit signature. A recovery-capable contract update and a fresh live lifecycle test are required before creation can reopen.

The local recovery-capable build checksum is currently `1925478399`, so it is not byte-identical to either live contract. No contract was deployed or updated during this frontend production pass.

## Permissions

- `invoke:primary` for contract writes
- `read:blockchain` for the escrow ledger
- NEP-17 payments for the initial NEO or GAS deposit

## Verification

From the repository root:

```bash
npx tsc -p apps/milestone-escrow/tsconfig.json --noEmit
cd apps/shared && npx vitest run test/milestone-escrow.logic.test.ts test/milestone-escrow.playarea.test.tsx test/milestone-escrow.setup.test.ts
npm --prefix apps/milestone-escrow run build
```
