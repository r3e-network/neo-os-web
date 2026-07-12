# Neo Treasury Production Status

Status on 2026-07-12: **code-complete for read-only dashboard use; direct-transfer live acceptance remains pending a funded Testnet proof**.

## Product surface

- The first viewport leads with the public Mainnet NEO/GAS watchlist, estimated USD value, attributed-group allocation, and a real treasury desk resource.
- Native balances, cached-balance fallback, partial RPC results, on-chain price freshness, and unavailable valuation are distinct states.
- USD is labelled as an estimate and never replaces the native NEO/GAS balances.
- The connected-wallet transfer route is visually and logically separate from the read-only watched addresses.
- Transfer fields, all 44 watched addresses, attribution limits, and execution details stay in secondary drawer surfaces.
- Official NEO/GAS artwork is supplied by the shared Neo press-kit-backed `CoinArt` component.

## Runtime boundary

- The app has no custom treasury contract, signer roster, proposal engine, quorum, timelock, or admin role.
- Mainnet watchlist reads use bounded-concurrency RPC failover. Failed wallets are excluded from partial totals and display `Balance unavailable`, never a fake zero.
- Native NEO/GAS values are parsed and summed as exact base-unit `BigInt` values. The dashboard and wallet drawer use exact decimal strings; floating-point numbers are limited to explicitly estimated USD arithmetic.
- Prices come from the Morpheus on-chain feed. An uninitialized zero-valued `AGG:*` record falls back to the current provider record; both final NEO and GAS legs must be finite and positive. Records older than one hour disable USD valuation; records older than five minutes but still usable are labelled delayed.
- Direct writes target only the native NEO or GAS contract and spend only from the connected wallet after exact network, Hash160, amount, decimals, self-transfer, and balance checks.
- Broadcast is not success. Confirmation requires the exact indexed native `Transfer` row plus both sender and recipient `balanceOf` readbacks. Recovery persists the txid and exact binding and never rebroadcasts.

## Current evidence

- Testnet and Mainnet native NEO/GAS hashes, `balanceOf`/`transfer` ABI shapes, decimals, and `Transfer` event shapes were re-read on 2026-07-12.
- N3Index `nep17_transfers` was checked live for the production row shape used by recovery matching.
- All 44 watched addresses resolved from Mainnet RPC in the live 2026-07-12 read-only pass, with every returned native amount validated as an unsigned integer before aggregation. All 44 app addresses were also still present in the current reference-site bundle.
- Dedicated logic, PlayArea, production-contract, price-freshness, official-token-asset, and Neo Treasury i18n-parity checks pass.
- TypeScript, ESLint, production build, static HTTP entry/assets, and MIME checks pass. Replacing the heavyweight input adapters with the shared semantic `OpenUiLite` controls reduced transformed modules from 3,582 to 1,853, the UI vendor chunk from 108.38 kB to 32.02 kB, and removed the separate 136.83 kB UI-vendor CSS output from this miniapp build.
- Key light-theme text pairs were checked with WCAG relative luminance: body ink 17.42:1, muted text 6.88:1, accent 6.60:1, success 6.06:1, warning 7.01:1, and danger 5.93:1.

## Remaining acceptance work

- A funded Testnet wallet must still broadcast a minimal NEO or GAS transfer to a separately controlled recipient and capture the exact indexed row plus both balance readbacks. No key or transaction was used in this pass.
- Browser/IAB screenshot comparison was unavailable in this task, so desktop/mobile visual sign-off is not claimed from build output alone.
- Address attribution is community-sourced and must not be treated as an official ownership registry.
- The fixed 44-address founder subset was rechecked against `https://neo-treasury.pages.dev/` on 2026-07-12; addresses outside these two named groups remain intentionally excluded.
