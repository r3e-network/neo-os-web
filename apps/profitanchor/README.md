# ProfitAnchor MiniApp

ProfitAnchor is the DeFi-facing client for `PlatformAnchor` mode `2`. It lets a
user stake whole NEO, redeem a live position, and claim actually accrued GAS
without exposing the operator route-management console.

## Product surface

- One primary stake command built around the existing reserve artwork.
- Live public pool state; wallet-only balances remain unavailable until a
  wallet is connected and the reads succeed.
- Redeem, claim, credit recovery, history, rules, and raw diagnostics stay in
  the secondary drawer.
- No projected APY. “Reserve coverage” is current funded GAS per staked NEO,
  not a promised return.

## Chain binding

| Field | Value |
| --- | --- |
| App ID | `miniapp-profitanchor` |
| Expected mode | `2` |
| Mainnet contract | `0x02beeef6f65c6989a121c0a0e6b23190333edb98` |
| Testnet contract | `0xab079b4f9a0a2471d136392e25eb8e99898dcad0` |
| Stake memo | `stake:miniapp-profitanchor` |

Before every write, the runtime rechecks the exact network, contract, app ID,
registration mode, pause state, wallet, and authoritative user balance.

## Transaction recovery

Every stake, redeem, claim, and NEO-credit recovery probes local storage before
the wallet opens. At broadcast time it persists the complete network/contract/
app/wallet/intent/txid binding. Refresh recovery checks that txid and never
rebroadcasts it. VM `FAULT` is terminal; unavailable logs stay pending. Success
requires a `HALT` log, the exact bound event, and a matching live readback.

See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md),
[NETWORK_STATUS.md](./NETWORK_STATUS.md), and
[ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).

## Development

```bash
npm run build
```
