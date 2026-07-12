# Gov Merc production status

Updated: 2026-07-12

## Product surface

- Resource-led civic auction desk using `public/gov-merc-market-stage.webp` as
  the dominant play surface.
- One contextual primary action: connect, bid, stake, settle, or read-only
  recovery. Balances, exits, reclaim actions, rules, and diagnostics live in the
  detail drawer.
- Warm light palette, solid high-contrast foreground panels, responsive layout,
  official shared NEO/GAS art, and motion driven only by a real in-flight or
  pending business state.

## Transaction guarantees

- Exact network, canonical v2 contract, and wallet binding before writes.
- Durable payment/action transaction journal with storage preflight and exact
  txid persistence.
- Refresh recovery never signs or resubmits.
- Exact VM state, contract-bound event parameters, and operation-specific
  readback are required before success.
- Failed reads stay unavailable rather than being rendered as a zero balance,
  empty market, or unopened bidding window.

## Live read-only evidence

On 2026-07-12, `getcontractstate` and `invokefunction` were called against
`https://testnet1.neo.coz.io:443` and `https://mainnet2.neo.coz.io:443`:

- v2 `0x140f5faf5692d21421a79278b0e45b9b9bd4bb46`: present on both networks,
  `MiniAppGovMerc`, update counter 0, `epochDuration = 300000`,
  `minBid = 100000000`, all reads `HALT`.
- v1 `0x1eb83eb5d4d3f073112064e8a3825f3b0e5f88e9`: present on both networks,
  `MiniAppGovMerc`, update counter 0. It remains an exit-only integration by
  platform policy; the legacy ABI itself is not paused and still exposes older
  bid/settle methods.

No wallet signing, funded transaction, contract update, or deployment was
performed. Browser visual QA was intentionally not run in this task.

## Local verification

- App tests: `15/15`; focused shared tests: `45/45`; app structure gate passed.
- TypeScript, scoped ESLint, and whitespace validation passed.
- Production build: 1,856 modules; app entry 224.03 kB (67.71 kB gzip), with
  React, UI, platform SDK, and crypto split into vendor chunks.
- Static HTTP verification: all `15/15` emitted files returned HTTP 200.
- Verified `dist/` was copied to the host miniapp directory and is byte-identical.
- Host catalog: 77 entries, 77 unique app IDs, one `miniapp-gov-merc` at version `1.1.0`.
