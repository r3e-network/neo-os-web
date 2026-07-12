# Last Survivor TestNet live validation — 2026-07-10

## Result

PASS. `MiniAppLastSurvivor` v1.1 was compiled from the current pull-payment source, deployed only to Neo N3 TestNet, wired into the app manifest, and exercised with two funded test accounts through a complete round.

- Contract: `0xff122a6cf7f22a88d059d61a9d9c07e84a2b56b9`
- Deployment transaction: `f3f7ff7fa95a48d02417bfaba98cf9dc78cff9db93562c885ce1a11636faae0a`
- Manifest version: `1.1.0`
- MainNet was not written. Its legacy address remains unchanged and the frontend now rejects gameplay writes when the pull-payment ABI probe is absent.

## Verified business flow

1. Player A bought the opening key for `10,000,000` base units (0.1 GAS).
2. Player B bought the second key for `10,010,000` base units (0.1001 GAS) and became the authoritative last buyer.
3. The round pot reached exactly `20,010,000` base units and `totalKeys` reached 2.
4. The script waited for the contract countdown, then Player A called permissionless `settle`.
5. `RoundSettled` identified Player B, the exact pot, and the next round. The settlement transaction emitted no GAS transfer to the winner; the pot appeared under `creditOf(B)` instead.
6. Player B withdrew all reusable and winner credit through `CreditWithdrawn`.
7. The next round opened cleanly.

Final authoritative reads:

- current round: 4
- pot: 0
- total keys: 0
- active: true
- Player A credit: 0
- Player B credit: 0
- contract GAS balance: 0

## Production issues found and fixed during validation

- The previous TestNet hash was an older push-payment build even though the repository source had already moved to pull payment. A new deterministic deployment was required; reusing the old hash would have produced false assurance.
- A live attempt proved that separate deposit and purchase transactions can cross the 30-second deadline. The frontend now prefers one atomic multi-invoke transaction for the GAS shortfall transfer plus `buyKeys`, with a confirmed two-step fallback only when the host lacks batch support.
- Purchase broadcasts are now persisted by exact txid, network, contract, and player. The UI blocks duplicates until the exact `KeysBought` event with matching round, player, count, and cost is recovered.
- Public RPC replicas briefly returned mutually stale round/balance snapshots. The live validator now waits for one coherent fresh-round snapshot and proves pull payment from the exact settlement application log rather than comparing two eventually consistent balance reads.

## Reproduction

```bash
node --test deploy/scripts/lib/live_validate_lastsurvivor.test.mjs
node deploy/scripts/live_validate_lastsurvivor.mjs
```

The live command requires the configured TestNet credentials. It never prints private keys.
