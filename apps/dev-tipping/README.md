# Developer Tipping

Developer Tipping is a recipient-first GAS payment MiniApp backed by the deployed `MiniAppTipJar` contract.

## Product flow

1. Load and verify the published contract generation for the active Neo N3 network.
2. Select a registered developer from the support board. Direct developer ID entry stays in the secondary drawer.
3. Choose a GAS preset or enter a custom amount with at most eight decimals.
4. Review the registered recipient identity, wallet, amount, visibility, and verified wallet GAS balance.
5. Confirm the funded tip once in the wallet.
6. Treat the txid as pending until the exact `Tipped` event and recipient state readback agree.

The deployed contract stores the developer ID, tipper address, Fixed8 amount, and anonymous flag. It does **not** store a free-form message or tipper display name.

## Transaction and recovery model

- Minimum tip: `0.001 GAS` (`100000` Fixed8 base units), verified against `minTip()`.
- Existing prepaid credit is read before payment. An RPC failure never falls back to zero and cannot authorize another deposit.
- When prepaid credit covers only part of the tip, the wallet deposits the exact shortfall rather than the full tip amount.
- The wallet GAS balance is read from the official GAS NEP-17 contract before payment.
- A pending receipt is scoped to network, contract, and sender and persisted before confirmation completes.
- A confirmed receipt requires the exact sender, developer ID, amount, visibility flag, and a matching `getDeveloper` total/count readback.
- Exact `FAULT`, pending, HALT-without-event, readback lag, expired receipt, and stranded-credit states have distinct recovery copy.
- A deposit that lands while `tip()` fails remains withdrawable through the contract credit path.
- Registration, developer withdrawal, and unused-credit withdrawal use the same exact-txid journal, event verification, and state-readback recovery model as tips.
- A stale receipt remains locked until it is conclusively reconciled; elapsed time alone never authorizes a duplicate action.

## Live bindings

Both deployments were read-only verified on 2026-07-11:

| Network | Magic | Contract | NEF checksum | Update counter |
| --- | ---: | --- | ---: | ---: |
| MainNet | `860833102` | `0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec` | `2483335541` | `0` |
| TestNet | `894710606` | `0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec` | `2483335541` | `0` |

The runtime attestation also checks the `MiniAppTipJar` name plus the required method and event signatures before enabling a write.

## Assets

- `public/support-board-stage.webp` is the app's existing warm developer support artwork and the selected catalog/Open Graph cover.
- GAS amounts use shared `CoinArt`, which is pinned by `apps/shared/test/official-token-assets.test.tsx` to the official Neo Press Kit GAS asset.
- UI icons come from the repository's existing Lucide system and are controls, not fake avatars or token art.

## Development

```bash
npm test
npx tsc -p tsconfig.json --noEmit
npm run build
```

No Oracle, TEE, AA relay, deployment, or server-side custody is part of this release.

See `PRODUCTION_STATUS.md`, `NETWORK_STATUS.md`, and `ASSET_PROVENANCE.md` for the current implementation, network acceptance boundary, and asset record.
