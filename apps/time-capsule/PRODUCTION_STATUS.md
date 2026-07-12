# Time Capsule production status

- Version: `1.1.0`
- Product surface: capsule-first social dApp
- Runtime: React + the shared miniapp design system
- Networks: Neo N3 MainNet and TestNet

## Product experience

- The warm chamber resource, message letter and countdown are the dominant surface; the generic contract-operation form is suppressed.
- One contextual primary action seals the capsule. Exact duration, category, visibility, owned capsules, public tips and reusable credit live in the secondary drawer.
- The only token mark is the shared official GAS `CoinArt`. RPC failures render unavailable states instead of zero balances or empty histories.
- Motion follows the real transaction lifecycle and respects reduced-motion preferences; there is no timer-driven preview success.
- The catalog cover uses the same in-app chamber resource, avoiding the obsolete legacy banner's TestNet-only badge for this dual-network product.

## Transaction and recovery behavior

- Every write is bound to the canonical launch/wallet network and configured contract.
- Recovery storage must complete a write/read/delete round trip before the wallet is opened.
- Payment and action broadcasts persist exact Neo Hash256 transaction IDs (`0x` plus 64 hexadecimal characters), network, contract, wallet and intent.
- A returned action transaction ID upgrades the recovery journal even if a host omits its transaction-sent callback, preventing a paid `bury` action from being submitted twice.
- Success requires the exact contract event and authoritative capsule/credit readback. `FAULT`, mismatched events and mismatched readback never create a success state.

## Local verification (2026-07-11)

- App production tests: `7/7` passed.
- Focused shared logic and interaction tests: `38/38` passed.
- Focused i18n parity: `1/1` passed (`78` unrelated cases skipped by filter).
- App-specific frontend structure gate: `1/1` passed.
- TypeScript and scoped ESLint: passed.
- Production build: `1855` modules; app entry `218.16 kB` / `65.79 kB` gzip.
- Static delivery: all `15/15` emitted HTML, manifest, JS, CSS and image files returned HTTP `200` with appropriate MIME types.
- The chamber, banner and logo raster assets were inspected locally. Browser rendering, wallet prompts and funded writes were intentionally not performed in this lane.

## Remaining release evidence

A release owner must still run the wallet-backed create, prepaid-credit recovery, reveal, public-tip and credit-withdraw flows on TestNet with disposable funds and record transaction IDs. The current live evidence is read-only and is documented in `TESTNET_STATUS.md`.
