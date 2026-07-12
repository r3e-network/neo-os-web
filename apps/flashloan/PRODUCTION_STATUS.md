# Flash Loan production status

Reviewed: 2026-07-12

## Product behavior

- The primary surface is a bright DeFi execution desk built around the real
  `flashloan-desk.webp` capital-route artwork, the shared official `CoinArt`
  token marks, Lucide controls, and the existing `PlayStage` / Open UI system.
- Loan amount, available pool, fee, exact repayment, callback target, wallet
  eligibility, network and contract health stay visible before signing.
- Callback configuration, liquidity management, loan lookup, history and
  contract parameters remain progressively disclosed in the tools drawer.
- Mobile keeps the live pool visible, uses a two-column capital selector and
  preserves readable route and eligibility text instead of compressing the
  signing evidence into 8-9 px labels.
- Pending and last-confirmed transaction IDs are visible in the product surface;
  local preflight copy is never presented as an on-chain result.

## Financial state machine

- Loan, deposit, finalize-only deposit recovery and withdrawal share one
  synchronous write lock. Host action dispatch cannot bypass the UI and open a
  second wallet flow while another financial action is active.
- Persisted pending records also block cross-flow writes after the active call
  returns; a pending loan cannot be followed by an LP write, or vice versa.
- Every write checks the canonical contract and wallet-reported network before
  the wallet prompt, immediately after it, and again before invocation. A wallet
  address change after review also fails closed.
- `onTransactionSent` and testnet `onPaymentSent` persist the first canonical
  transaction ID. Conflicting callback/result IDs retain the first pending lock
  for manual review and never become success.
- Recovery is network-, contract- and wallet-bound. A recovered prior action is
  reported as prior history; the new click is not replayed and does not receive
  a misleading success result.
- Loan success requires the exact transaction-bound `LoanExecuted` event,
  matching account/amount/fee/success fields, matching `getLoanDetails`, fresh
  platform stats and fresh borrower eligibility.
- Liquidity success requires the exact transaction-bound event plus provider
  lifetime counters and a structurally valid fresh platform read. Testnet
  payment-only recovery proves the exact GAS transfer before exposing the
  finalize-only action and never sends GAS twice.
- VM `FAULT` is distinct from unknown or delayed confirmation. Unknown state,
  missing event, readback disagreement and stale indexer state stay pending or
  manual-review; only a proven `FAULT` clears the appropriate failed action.
- Wallet-scoped refreshes and loan lookups use epochs so slower reads for an old
  wallet or older lookup cannot overwrite the newest product state.
- Wallet addresses now pass through the canonical Hash160 builder for loan,
  deposit and withdrawal calls; base58 wallets and script hashes therefore
  produce one ABI-correct argument shape across adapters.
- Contract pause, borrower eligibility and loan executed/success fields use
  strict booleans. Malformed loan accounts, callback methods, timestamps or
  integer fields are rejected rather than displayed as plausible pending loans
  or treated as an unpaused contract.
- Every financial action refreshes durable recovery records before its own
  pending-state check. Recovery probes verify deletion, confirmed cleanup keeps
  the in-memory lock if durable deletion fails, and wallet connection now shares
  the same synchronous operation boundary as all money actions.

## Offline verification

- Focused Vitest: 86/86 passing across composable logic, product behavior and
  structure/ABI gates.
- TypeScript: `tsc --noEmit --incremental false` passes.
- ESLint: Flash Loan source and focused tests pass without warnings.
- Asset inspection confirms the active desk is a valid 1672 x 941 WebP and the
  catalog WebP/AVIF assets decode locally.
- Production build: 3,580 modules; app entry 255.00 kB (75.12 kB gzip), UI
  vendor 200.10 kB (63.60 kB gzip), React vendor 142.41 kB (45.79 kB gzip),
  platform SDK 94.10 kB (30.28 kB gzip), app CSS 114.00 kB (20.39 kB gzip)
  and UI vendor CSS 136.83 kB (14.82 kB gzip).
- Local Vite static preview returned HTTP 200 for all 17 emitted files;
  `flashloan-desk.webp` served as `image/webp`, and the served manifest retained
  the app id, mainnet default and empty duplicate operation panel.
- The rebuilt dist is byte-identical to the host copy. The generated host
  catalog remains 77/77 unique app IDs with exactly one Flash Loan `1.1.0`
  entry using the product-specific WebP icon and banner.
- The only build warnings are upstream Semi UI Dart Sass `@import` deprecations.

## Deliberately unverified in this pass

- No browser, Playwright or screenshot-based design audit was run.
- No live RPC request, wallet connection, signature, funded transaction,
  deployment or contract mutation was performed.
- The deployed NEF source matching both contract hashes is not present here, so
  this pass does not claim source-to-bytecode verification.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the frozen network evidence and
[ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for resource lineage.
