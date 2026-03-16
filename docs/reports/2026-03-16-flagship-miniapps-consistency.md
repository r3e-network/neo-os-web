# 2026-03-16 Flagship MiniApps Consistency Report

## Scope

This report covers the first-wave flagship Neo N3 miniapps:

1. LastSurvivor
2. GASBOX
3. Red Envelope
4. Daily Check-in
5. FogPlay
6. SelfLoan
7. NeoPay

## Mappings

| Brand | Frontend | Contract |
| --- | --- | --- |
| LastSurvivor | `apps/doomsday-clock` | `contracts/MiniAppDoomsdayClock` |
| GASBOX | `apps/neo-gacha` | `contracts/MiniAppNeoGacha` |
| Red Envelope | `apps/red-envelope` | `contracts/MiniAppRedEnvelope` |
| Daily Check-in | `apps/daily-checkin` | `contracts/MiniAppDailyCheckin` |
| FogPlay | `apps/coin-flip` | `contracts/MiniAppCoinFlip` |
| SelfLoan | `apps/self-loan` | `contracts/MiniAppSelfLoan` |
| NeoPay | `apps/stream-vault` | `contracts/MiniAppStreamVault` |

## Current Verified Testnet Addresses

| Brand | Testnet Contract |
| --- | --- |
| LastSurvivor | `0xf0914d411877c8393c029f48ec0c4c64d44f1b49` |
| GASBOX | `0x523c112560a2e196fa0fcfa215d93c08e117d9c1` |
| Red Envelope | `0x4079c09a0ff121fc44d817c37d6ae8694b268e9f` |
| Daily Check-in | `0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528` |
| FogPlay | `0x43f953c00931ca38044bf0e5ca50d608aea7ae8b` |
| SelfLoan | `0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b` |
| NeoPay | `0x89d2499928e3035247186f412934d6b0e0b665ef` |

## Validation Performed

- Host app targeted tests passed:
  - `__tests__/lib/miniapp-media.test.ts`
  - `__tests__/lib/miniapp-definitions.test.ts`
  - `__tests__/lib/miniapp-id.test.ts`
- Host app production build passed:
  - `npm --prefix platform/host-app run build`
- Frontend Vite production builds passed for:
  - `apps/doomsday-clock`
  - `apps/coin-flip`
  - `apps/neo-gacha`
  - `apps/red-envelope`
  - `apps/daily-checkin`
  - `apps/self-loan`
  - `apps/stream-vault`
- Targeted contract build passed for:
  - `contracts/MiniAppDailyCheckin/MiniAppDailyCheckin.csproj`
  - `contracts/MiniAppDoomsdayClock/MiniAppDoomsdayClock.csproj`
  - `contracts/MiniAppNeoGacha/MiniAppNeoGacha.csproj`
  - `contracts/MiniAppRedEnvelope/MiniAppRedEnvelope.csproj`
  - `contracts/MiniAppCoinFlip/MiniAppCoinFlip.csproj`
  - `contracts/MiniAppSelfLoan/MiniAppSelfLoan.csproj`
  - `contracts/MiniAppStreamVault/MiniAppStreamVault.csproj`
- Automated flagship audit added and run:
  - `npm run -s test:flagship-miniapps`
  - `npm run -s test:flagship-deployed-abi`
  - `npm run -s test:flagship-update-dryrun`

## Fixes Landed

- Host-side app id canonicalization updated for `daily-checkin` and `neo-gacha`.
- Host registry, home catalog, icon map, template bindings, and public miniapp definitions were aligned to the seven flagship apps.
- Missing host definitions were added for:
  - LastSurvivor
  - GASBOX
  - Daily Check-in
  - SelfLoan
  - NeoPay
- Existing host definitions were updated for:
  - FogPlay
  - Red Envelope
- `Daily Check-in` contract and frontend were updated to match the intended product rule:
  - day 7 => `1 GAS`
  - day 14 => `2 GAS`
  - then reset the streak cycle
- `LastSurvivor` contract countdown logic was aligned with the marketed rules:
  - round starts at `24 hours`
  - each purchase resets the clock back to `24 hours`
- `FogPlay` manifest copy was corrected to describe the real implemented coin-flip flow rather than an encrypted PvP match flow.
- `MiniAppStreamVault` contract source was added for NeoPay, compiled successfully, and deployed on testnet at `0x89d2499928e3035247186f412934d6b0e0b665ef`.
- Shared wallet SDK now normalizes contract operation names to ABI-style lower camel case before invocation, eliminating a cross-app PascalCase/lowerCamel mismatch.
- `GASBOX` contract regained compatibility entrypoints `initiatePlay / settlePlay`, and the misleading frontend revenue-withdraw action was removed.
- `FogPlay` frontend was moved back onto the live contract path:
  - uses `placeBet`
  - waits for `BetPlaced`
  - polls `BetResolved`
  - no longer calls the nonexistent `initiateBet / settleBet` flow
- Morpheus Oracle integration for contract-mediated callback flows was updated
  to use `requestFromCallback(...)`, which fixes the prior nested-call
  `unauthorized requester` fault for direct MiniApp -> Oracle execution.
- Shared testnet `rng` routing was corrected in the local relayer stack so
  `request_type = rng` now reaches `/vrf/random` and returns raw 32-byte
  randomness bytes instead of being misrouted to URL fetch handling.
- `FogPlay` was revalidated against the new testnet deployment:
  - contract: `0x43f953c00931ca38044bf0e5ca50d608aea7ae8b`
  - request id `3857` fulfilled successfully on testnet
- `Red Envelope` was revalidated against the new testnet deployment:
  - contract: `0x4079c09a0ff121fc44d817c37d6ae8694b268e9f`
  - request id `3858` fulfilled successfully on testnet
  - envelope `3` became `Ready = true`
  - claim tx `0x0ede646f330c9c7ba4a873da00629ac0584fe954c398334d5cd5a376ce6b1a2d` completed and transferred GAS
- `SelfLoan` testnet contract was updated in place at `0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b` to use direct NEO collateral credit plus explicit GAS pool funding.
- `SelfLoan` live borrow path was validated on testnet:
  - collateral transfer tx: `0xb2597e1f0ccb16e14b5b97b0f1788084ea83c6fbd2da185323cdb002783e9ac9`
  - loan creation tx: `0xd3efe7e23da846911b45784737f2c754eb866f3ad81b6724630f0bbaf2892f3f`
  - resulting loan: `loanId = 1`, `collateral = 1`, `debt = 20000000`
- `FogPlay` PvP duel scaffold was removed again so the codebase matches the current single-player user-versus-system product decision.
- Host contract stats and live-status queries were retargeted to the currently deployed flagship testnet contracts and verified against live RPC responses.
- Host public miniapp definitions were updated to the latest flagship testnet contract hashes.
- Flagship manifests now default to `neo-n3-testnet` so the currently verified network is unambiguous in platform surfaces.
- FogPlay, NeoPay, Red Envelope, Daily Check-in, LastSurvivor, and GASBOX manifest claims were narrowed where the live app does not yet expose AA / TEE / NeoDID flows.
- Cross-repo testnet validation passed:
  - direct Oracle smoke tx: `0xe9f561e6d9f157950e7f51e71dbe40a2680c5b3313b31c2044fe3de50208e2c3`
  - direct AA relay tx: `0x1523625a53c74db6106833d1bc63ccbbfb4874137364633e7f129e0e5e9a4ce9`
- Contract READMEs were refreshed for:
  - `MiniAppDailyCheckin`
  - `MiniAppSelfLoan`
  - `MiniAppNeoGacha`

## Current Known Blockers

`NeoPay` is deployed and wired for testnet, but its broader roadmap remains intentionally out of scope for the live build.

- Current implementation is the base recurring stream ledger.
- AA scheduling, NeoDID verification, and TEE privacy processing are **not** part of the live testnet release.

`FogPlay` intentionally remains a single-player product in the current release.

- Current implementation is a fast user-versus-system coin-flip game.
- PvP duel mode is not part of the live product surface or contract.

Remaining work is now concentrated in deeper end-to-end product execution rather than address drift.

- Most flagship miniapps still use direct wallet flow rather than a fully wired AA relay / paymaster UX.

## Additional Notes

- A full repository-wide `contracts/build.sh` run still fails on an unrelated pre-existing `MiniAppFactoryV2` ambiguity issue. That failure is outside the flagship miniapp scope, but it means the repo does not yet have a clean full-contract build baseline.
