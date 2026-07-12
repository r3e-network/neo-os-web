# NeoPay Stream Studio

NeoPay Stream Studio is the product-facing shared-runtime variant of NeoPay. It keeps the reusable funding-vault and stream-vesting composition metadata, while presenting the live `MiniAppNeoPay` flow as a focused payment workstation instead of a generic operation form.

## Product flow

1. Choose the official GAS or NEO asset.
2. Enter a valid Neo N3 recipient, amount, and a 1–365 day duration.
3. Review the payment ticket, release model, network, and canonical contract binding.
4. Confirm one atomic wallet transaction that funds and creates the stream.
5. Use the secondary drawer to refresh authoritative stream lists, claim a listed incoming stream, cancel a listed outgoing stream, or review exact parameters.

NEO amounts must be positive whole tokens. GAS amounts must be positive and use at most eight decimal places. Draft input is never silently truncated when the selected asset changes.

## Production behavior

- Mainnet: `0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34`
- Testnet: `0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e`
- Contract: `MiniAppNeoPay`
- Create: atomic NEP-17 funding plus `createStream`
- Recovery: a submitted transaction is stored as pending and refreshed from chain state; refresh never rebroadcasts it
- Claim/cancel: available only for streams returned by the authoritative role-specific lists
- Read failure: the UI exposes unavailable/partial service state and hides zero-count or empty-list conclusions until a complete chain read succeeds

See [NETWORK_STATUS.md](./NETWORK_STATUS.md), [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md), and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for verification and asset details.

## Local build

```bash
cd apps/neo-pay-shared-example
npm run build
```

No funded transaction, wallet signature, contract deployment, or host copy is part of the local frontend verification workflow.
