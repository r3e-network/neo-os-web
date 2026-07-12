# Quadratic Funding MiniApp

Quadratic Funding is a Neo N3 public-goods funding desk. Communities can create time-bounded rounds, register projects, contribute NEO or GAS, review an off-chain matching suggestion, finalize allocations on-chain, and let project owners claim the result.

## What is actually enforced

- The contract stores rounds, projects, per-wallet contributions, aggregate wallet counts, match allocations, and claim state.
- Contributions are accepted only inside the selected round's active window.
- Project owners and round creators are excluded from contributing by the current source contract.
- Only the platform admin (or configured gateway) can finalize a round after it ends.
- Final matched amounts are supplied off-chain and checked only for valid project IDs, non-negative amounts, uniqueness, and total allocation not exceeding the pool.
- The contract does **not** verify human identity and is **not Sybil-resistant**. `contributorCount` counts wallet addresses.

## Matching preview

Exact CLR requires every donor contribution `cᵢⱼ`:

```text
subsidyWeightᵢ = (Σⱼ √cᵢⱼ)² − Σⱼ cᵢⱼ
```

The deployed read API exposes only total contributed `Tᵢ` and wallet count `nᵢ`. The frontend therefore labels its result as an aggregate estimate and uses the equal-split simplification:

```text
estimatedWeightᵢ = max(nᵢ − 1, 0) × max(Tᵢ, 0)
```

The matching pool is allocated proportionally with integer arithmetic. Largest-remainder rounding deterministically assigns base-unit dust without exceeding the pool. Inactive projects and single-wallet projects receive a zero suggestion. The platform admin must review the result before finalization.

## Production transaction readiness

The app uses a two-transaction prepaid-asset flow: first transfer NEO/GAS credit to the contract, then invoke the consuming action. A production deployment must expose `directAssetCreditOf` and `reclaimDirectAssetCredit`; otherwise a failed second transaction can leave credit with no withdrawal route. Before any deployment is approved for writes, the contract must also emit an app-level reclaim event and the frontend must expose the reclaim/refund paths listed in `TESTNET_STATUS.md`.

As of 2026-07-11, the configured mainnet and testnet contract at `0xe2fba2a73cf92874ecc41b7fff8d3d5da0354c43` is an older deployment (`updatecounter: 0`) that does not expose those recovery methods. The frontend probes this capability and stays in explore mode when it is missing. Responding methods and a stable script hash are not enough because Neo upgrades retain the address: the exact `network:contract:code-fingerprint` entry must also complete the production lifecycle scenarios. The production build currently approves no deployment, so it does not expose any contract write or send a funding deposit merely because a contract address exists.

See [TESTNET_STATUS.md](./TESTNET_STATUS.md) for the read-only verification record and the remaining activation steps.
See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for the user-flow and release-gate summary.

## User flows

1. Browse and select an on-chain round.
2. Pick a project card and review the round asset, amount, and matching caveat.
3. When a recovery-capable deployment is verified, sign the deposit and contribution transactions.
4. Project owners register and later claim from the secondary workspace.
5. Round creators manage matching reserves, cancellation, and unused matching.
6. The platform admin reviews the aggregate estimate and finalizes only after round end.

Every supported write waits for its exact contract event and then reads the affected round/project/contribution back from chain. A broadcast without the expected event/readback is reported as pending, never as completed.

## Development

```bash
npm run dev --prefix apps/quadratic-funding
npx tsc -p apps/quadratic-funding/tsconfig.json --noEmit
npx vitest run apps/shared/test/quadratic-funding.match.test.ts \
  apps/shared/test/quadratic-funding.rounds.test.ts \
  apps/shared/test/quadratic-funding.flows.test.ts \
  apps/shared/test/quadratic-funding.pending.test.ts \
  apps/shared/test/quadratic-funding.playarea.test.tsx \
  --config apps/shared/vitest.config.ts
npm run build --prefix apps/quadratic-funding
```

The implementation is React on the shared MiniApp framework and v2 design system. `public/funding-desk.webp` is the real scene asset used by the funding workspace; the core flow is project-card and pledge driven rather than a first-screen parameter form.
