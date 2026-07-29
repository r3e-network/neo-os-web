# AA Market Hub Frontend Validation - 2026-06-01

## Scope

- Target: `miniapp-aa-market-hub` in `neo-os-web`
- Route: `http://127.0.0.1:3000/miniapps/aa-market-hub?network=testnet`
- Focus: host action console completeness, iframe launch params, embedded AA market form UX, wallet-gated submit, desktop/mobile layout.

## Findings Fixed

1. Host action console exposed only `price` and `item`, but the embedded create-listing flow requires `marketHash`, `aaContractHash`, `accountIdHash`, `priceGas`, `listingTitle`, and optional `metadataUri`.
2. The embedded create form enabled submission from local `marketHash` state, but `submitCreateListing()` read `hub.marketHash`, so host-launched create flows could submit without the selected market contract in domain state.
3. `AA Contract Hash` said it defaulted to the canonical AA core, but the field was empty unless the user typed it.
4. The create button was enabled before the embedded wallet was connected. A failed submission could clear user-entered account/price/title values.

## Changes

- Added full AA Market Hub operation params to the host fallback profile, with network-aware testnet defaults:
  - market: `0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf`
  - AA core: `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2`
- Wired launch params into the embedded PlayArea form and mirrored runtime state defaults.
- Passed `marketHash` into `createListing` and persisted it before invoking `submitCreateListing()`.
- Added wallet gating to embedded create submission and kept form values intact on failed/undefined dispatch results.
- Let `MiniAppRoot` return action handler results at runtime while preserving its existing `Promise<void>` prop type.

## Browser Evidence

- Desktop host default state: `docs/reports/aa-market-hub-after-host-defaults.png`
- Host action applied to iframe: `docs/reports/aa-market-hub-host-action-after-wallet-gate.png`
- Mock OneGate create-listing success path: `docs/reports/aa-market-hub-create-listing-mock-success.png`
- Mobile layout check: `docs/reports/aa-market-hub-mobile-after.png`

Observed in browser:

- Host URL and iframe `src` included `marketHash`, `aaContractHash`, `accountIdHash`, `priceGas`, and `listingTitle`.
- Embedded form was prefilled with all required contract inputs.
- Before embedded wallet connect, `Create Listing` was disabled and showed a wallet-required hint.
- After mock OneGate connect, `Create Listing` enabled.
- Submitted invocation called `createListing` on `0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf` with:
  - AA core hash: `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2`
  - Account ID hash: `0x1111111111111111111111111111111111111111`
  - Price fixed8: `1800000000`
  - Title: `AA service package`
- Signer used `CustomContracts` scoped to the market and AA core contracts.
- Desktop and mobile host/iframe `overflowX` were `0`.
- Browser console/page errors: none.

## Verification Commands

- `cd apps/shared && npx vitest run test/aa-market-hub.playarea.test.tsx`
- `cd apps/shared && npx vitest run test/aa-market-hub.playarea.test.tsx test/miniapp-root.runtime.test.ts`
- `cd platform/host-app && npm test -- --runInBand __tests__/components/PlayAreaRegistry.test.tsx __tests__/components/OperationPanel.test.tsx`
- `cd platform/host-app && npm run typecheck`
- `npm run -s build:miniapp-dapps -- aa-market-hub`
- `npm run -s stage:miniapps:dist -- aa-market-hub`

## Remaining Notes

- This slice verified the write path through a mock NEP-21/OneGate provider and inspected the exact invocation payload. A real testnet transaction still requires a funded connected wallet in the browser session.
- The broader goal remains active; this report covers only the AA Market Hub frontend/host action slice.
