# Neo Treasury

Neo Treasury is a public-balance watchlist plus a safety-focused native-token transfer surface. It does **not** control the watched wallets and it is not a treasury multisig contract.

## Product boundary

- The balance scene reads a fixed, community-attributed list of Da Hongfei and Erik Zhang addresses from Neo N3 **Mainnet**.
- The 44-address founder-group list was rechecked against `https://neo-treasury.pages.dev/` on 2026-07-12. Addresses outside these two named groups are intentionally not mixed into the app totals.
- A transfer spends only from the wallet that is currently connected to the app.
- The app has no custom deployed contract. It invokes the native NEO or GAS token contract directly.
- The watchlist is not an official ownership registry. Attribution should be independently verified before using it for governance, accounting, or compliance decisions.

## Primary flow

1. Review the Mainnet watchlist totals, native NEO/GAS balances, attributed-group allocation, and independent balance/price freshness signals.
2. Open the payout drawer and choose NEO or GAS, an amount, and a recipient.
3. Review the exact network, native token contract, source wallet, recipient Hash160, base-unit amount, and optional memo.
4. Confirm the same values in the connected wallet.
5. After broadcast, wait for both:
   - an indexed native `Transfer` event matching txid, network, token contract, sender, recipient, and amount; and
   - an authoritative native-token `balanceOf` readback consistent with that transfer.

A transaction hash by itself is never shown as a confirmed transfer.

## Wallet safety and recovery

- Wallet network detection must resolve to the selected Neo N3 Mainnet or Testnet. Unknown and mismatched networks fail closed.
- NEO amounts must be whole tokens. GAS supports up to eight decimals.
- Self-transfers, non-positive values, invalid addresses, overlong memos, insufficient balances, and spending the entire GAS balance are blocked before wallet review.
- The wallet review is rebuilt from current wallet/network inputs for each write. The native transfer has no app-enforced or on-chain expiry, so users must review the wallet prompt rather than assume an expiry guard exists.
- The exact broadcast binding and pre-transfer sender/recipient balances are persisted per network as soon as the wallet returns the txid.
- Refreshing or pressing **Check Transfer Proof** only rechecks that saved txid. It never signs or rebroadcasts another transfer.
- Pending, unavailable, readback-lagging, and binding-mismatch states remain visibly distinct from confirmed success.
- A transfer is confirmed only when both sender and recipient native balances are consistent with the saved pre-transfer baseline; one-sided movement is not enough.

## Native contracts

The same Neo native contract hashes and ABI shapes are present on Mainnet and Testnet:

| Asset | Contract | Transfer ABI | Confirmation event |
| --- | --- | --- | --- |
| NEO | `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5` | `transfer(Hash160 from, Hash160 to, Integer amount, Any data) -> Boolean` | `Transfer(Hash160 from, Hash160 to, Integer amount)` |
| GAS | `0xd2a4cff31913016155e38e474a2c06d08be276cf` | `transfer(Hash160 from, Hash160 to, Integer amount, Any data) -> Boolean` | `Transfer(Hash160 from, Hash160 to, Integer amount)` |

Both contracts expose safe `balanceOf(Hash160) -> Integer` reads used for spendability and post-event state verification.

## Governance controls not present

There is no treasury vault, proposal ID, signer roster, quorum, admin role, timelock, or on-chain proposal expiry in this app. Calling the transfer a governed treasury action would be misleading. Use a governed multisig/vault product when those controls are required.

## Networks

- Default transfer network: Neo N3 Mainnet.
- Supported transfer networks: Neo N3 Mainnet and Testnet.
- Public watchlist data: Mainnet only, clearly labeled even when the transfer surface is opened on Testnet.
- Testnet read-only verification: see [TESTNET_STATUS.md](./TESTNET_STATUS.md).

## Visual system

- The vault desk illustration is the primary treasury resource, with a clean white foreground and warm gold/Neo-green accents.
- NEO and GAS artwork is rendered through the shared `CoinArt` component, which uses the official Neo press-kit token assets.
- Asset sources, production usage, and integrity hashes are recorded in [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).
- Public balances and attributed-group allocation lead the first viewport. USD values are explicitly presented as estimates rather than spendable balances.
- Balance-cache freshness and Morpheus price-record freshness are separate signals; a delayed quote never relabels a fresh native-balance sweep as cached.
- USD valuation is disabled unless both the NEO and GAS price legs are finite and positive, preventing a missing GAS quote from silently understating the watchlist.
- Native balances are parsed and aggregated in base units with `BigInt`; displayed NEO/GAS values never pass through floating-point rounding. JavaScript numbers are retained only for explicitly estimated USD arithmetic.
- An uninitialized zero-valued Morpheus `AGG:*` record falls back to the live provider record instead of suppressing a usable quote.
- Transfer inputs, the complete 44-address watchlist, and execution-policy details stay in the drawer so the dashboard and one primary action retain the visual hierarchy.

## Development

```bash
npm --prefix apps/neo-treasury run dev -- --port 5361
npm --prefix apps/neo-treasury run build
npx tsc --noEmit -p apps/neo-treasury/tsconfig.json
npx eslint apps/neo-treasury/src --ext .ts,.tsx
npx vitest run apps/shared/test/neo-treasury.logic.test.ts apps/shared/test/neo-treasury.playarea.test.tsx apps/shared/test/price-feed-freshness.test.ts apps/shared/test/official-token-assets.test.tsx
```
