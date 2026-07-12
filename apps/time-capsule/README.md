# Time Capsule

A capsule-first Neo N3 miniapp for sealing a local message hash behind a refundable time lock.

## Production flow

1. Write a title and message. The full message remains in this browser; only its SHA-256 digest is sent on-chain.
2. Choose a 1–3650 day lock. Category, exact duration and visibility are progressively disclosed in capsule settings.
3. Prepay a 0.2 GAS refundable deposit and call `bury`. A confirmed `Buried` event plus an exact `getCapsule` readback is required before success is shown.
4. After the countdown, the owner calls `reveal`. The deployed contract returns the locked GAS atomically; the app requires the exact `Revealed` event and readback.
5. A different wallet may tip one public, unrevealed capsule once by transferring 0.05 GAS with the `miniapp-timecapsule:fish:<id>` memo. The deployed contract forwards the tip directly to the owner.

Broadcast is not success. Before any wallet write, the app proves that its recovery store can round-trip data. Unverified writes persist the exact network, contract, wallet, intent and transaction id; they block replay and can be checked after refresh. If storage fails after broadcast, the app keeps the transaction id in-session and explicitly tells the user not to submit again. RPC failures are shown as unavailable data, never as a genuine zero balance or empty vault.

The product surface is capsule-first: the bright chamber asset, local letter and one Seal Capsule action hold the primary stage. Exact duration, category, visibility, capsule history, public tips and deposit recovery stay in the details drawer. The sealing animation follows the real transaction lifecycle; there is no timer-based preview success.

## Current chain boundary

| Property | Value |
|---|---|
| App ID | `miniapp-time-capsule` |
| Category | Social |
| Version | 1.1.0 |
| Mainnet contract | `0x3e88058ef32c4d8d17eb1a2188d6d5e329c94f8a` |
| Testnet contract | `0x3e88058ef32c4d8d17eb1a2188d6d5e329c94f8a` |
| State endpoint | `https://api.n3index.dev/{mainnet,testnet}` |

The deployed ABI supports `bury`, `reveal`, `withdraw`, `lastCapsuleId`, `creditOf`, `getCapsule`, `ownerCapsuleCount`, and `getOwnerCapsules`. Fishing is handled by `onNEP17Payment` and emits `Fished`. The deployed contract forwards the tip directly and does **not** expose the newer local-build `fishRevenueOf` / `withdrawFishRevenue` ledger API, so the frontend does not offer a broken collect-tips control.

No oracle is required: the contract uses Neo runtime time for the lock and Neo N3 atomic execution for refund/tip settlement.

## Local verification

```bash
cd apps/shared
npx vitest run test/time-capsule.logic.test.ts test/time-capsule.playarea.test.tsx
npx vitest run test/i18n-key-parity.test.ts -t time-capsule

cd ../time-capsule
npx tsc --noEmit -p tsconfig.json
npm run build
```

See `PRODUCTION_STATUS.md`, `ASSET_PROVENANCE.md`, and `TESTNET_STATUS.md` for the verified frontend, retained art, live read-only evidence, and remaining funded-write boundary.
