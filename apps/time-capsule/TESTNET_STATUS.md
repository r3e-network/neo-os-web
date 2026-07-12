# Time Capsule live verification

Verified read-only on 2026-07-11 (UTC) against `https://api.n3index.dev/mainnet` and `https://api.n3index.dev/testnet`.

## Confirmed

- Contract hash on both networks: `0x3e88058ef32c4d8d17eb1a2188d6d5e329c94f8a`.
- `getcontractstate` returned `MiniAppTimeCapsule` on both networks.
- Both deployed ABIs expose `onNEP17Payment`, `bury`, `reveal`, `withdraw`, `lastCapsuleId`, `creditOf`, `getCapsule`, `ownerCapsuleCount`, and `getOwnerCapsules`.
- Both deployed ABIs expose `Credited`, `Buried`, `Revealed`, `Fished`, and `CreditWithdrawn`.
- `lastCapsuleId` returned VM state `HALT` and value `0` on both networks at verification time.

## Important ABI drift

The local build artifact additionally contains `getOwner`, `update`, `fishRevenueOf`, `withdrawFishRevenue`, and `FishRevenueWithdrawn`. Those entries are not present in either live deployment. The production frontend is bound to the live ABI: fishing tips are forwarded directly by the deployed `onNEP17Payment` implementation, and no collect-tips ledger UI is exposed.

## Not claimed

- No transaction was signed or broadcast during this closure pass.
- No funded bury/reveal/withdraw/fish sequence was executed.
- No contract was deployed or updated.
- Live browser validation was intentionally outside this lane. The frontend was verified through focused interaction tests, TypeScript, lint, production build, static HTTP responses, and direct inspection of the local chamber asset.

A funded testnet write pass is still required to prove the full wallet lifecycle on the current host integration. Until then, the manifest records the contracts as deployed with read-only verification, not fresh write validation.
