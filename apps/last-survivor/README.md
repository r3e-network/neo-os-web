# Last Survivor

Last Survivor is a bright Phaser 3 last-seat duel. In the current production entry, local rivals steal the lead on an unpredictable rhythm. Players choose between safer large key packs and higher-scoring small packs, reclaim the final seat, and must still hold it when the countdown reaches zero.

## Player flow

1. Enter the free Phaser arena; no wallet or GAS is requested.
2. Load a key pack to claim the open final seat. Large packs add more time; small packs preserve more scoring upside.
3. Watch the live leader cue. A local rival can steal the seat, then briefly extends the clock.
4. Reclaim late for a clutch bonus. Controls lock while the player already leads, preventing score spam.
5. At zero, a leading player banks the pressure score to the best-effort off-chain board; an eliminated player restarts immediately.

The GameFi contract lane is implemented but not advertised in this frontend release. The TestNet contract completed its two-wallet buy → expiry → settle → withdraw harness. The frontend now journals every wallet write, blocks replay, and requires exact event plus contract readback; this refreshed build still needs a new browser/wallet matrix. Runtime action guards independently reject new paid rounds, while historical credit/settlement recovery remains available to stale deep links.

## Verified TestNet contract rules

- Base key price: `10_000_000` base units (0.1 GAS).
- Per-key price increment: `10_000` base units.
- Each key extends the active clock by 30 seconds.
- Remaining time is capped at 86,400 seconds.
- Maximum purchase: 1,000 keys per transaction.
- Settlement is permissionless and uses pull-payment credit; it never pushes GAS to the winner during `settle`.
- There is no oracle or off-chain randomness in this game.

### Public ABI

| Method | Type | Purpose |
| --- | --- | --- |
| `getCurrentRound()` / `getRound(id)` | Read | Round, pot, key total, last buyer, end time, active state |
| `currentKeyCost(count)` / `keyCost(total,count)` | Read | Authoritative arithmetic-curve quote |
| `playerKeys(roundId,player)` | Read | Player key total for a round |
| `creditOf(player)` | Read | Reusable deposit or winner credit |
| `buyKeys(player,count)` | Write | Consume credit, grow the pot, become last buyer, extend clock |
| `settle()` | Write | Credit the winner and open the next round |
| `withdraw(account)` | Write | Withdraw all reusable/winner credit |

## Deployments

| Network | Contract | Status |
| --- | --- | --- |
| Neo N3 TestNet | `0xff122a6cf7f22a88d059d61a9d9c07e84a2b56b9` | v1.1 pull-payment build; exact local NEF checksum and live ABI match, and the two-wallet contract harness passed 2026-07-10. New paid UI entry remains hidden pending refreshed wallet/browser validation. |
| Neo N3 MainNet | `0x8e1e432e966357de8d7642564b744d3274a81bd0` | v1.0 exposes the read ABI, but its deployed NEF differs from the verified TestNet generation. No new frontend writes are enabled or claimed as validated. |

The canonical network mapping is [`neo-manifest.json`](./neo-manifest.json). Never copy an address from this document into transaction code.

## Development

```bash
cd apps/last-survivor
npm test
npm run build
npm run dev
```

The production surface uses React + Phaser 3. Free mode is local-only and never calls wallet, chain, oracle, or reward writes. See [`PRODUCTION_STATUS.md`](./PRODUCTION_STATUS.md) for the verified frontend result, [`TESTNET-STATUS.md`](./TESTNET-STATUS.md) for the paid activation gate, and [`ASSET_PROVENANCE.md`](./ASSET_PROVENANCE.md) for the current artwork record.
