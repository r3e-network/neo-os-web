# NeoPay Shared Runtime Frontend Validation

Generated: 2026-06-02T09:28:00+08:00

## Scope

This slice focused on `miniapp-neo-pay-shared-example`, the weakest current PlayArea audit row by detectable controls. The previous standalone PlayArea only re-exported `neo-pay`, so the shared-runtime app looked like a thin example shell in source audits even though it had registered actions.

No WIF or private key was used in this slice. Browser validation operated the staged frontend bundle and mocked only local static-server POST responses because `python http.server` cannot serve `/api/edge/*`.

## Changes

- Replaced the `neo-pay` re-export with a dedicated shared-runtime payment stream workspace.
- Added a stream composer with title, recipient, amount, duration, token, notes, presets, clear state, and readiness gating.
- Added transaction preview rows for recipient, total amount, release amount, interval, and the shared module route (`funding_vault -> stream_vesting -> createStream`).
- Added outgoing and incoming stream lists with progress, status, claimable amount, cancel, and claim actions.
- Updated the shared `createStream` action to preserve a user-supplied stream title.
- Added the manifest-side `title` field for host operation parity.
- Added focused React tests for composer completeness, create dispatch payload, and stream cancel/claim actions.

## Audit Result

`npm run -s audit:miniapps:playareas`

- Total active miniapps: 60
- Catalog-level PlayArea gaps: 0
- `miniapp-neo-pay-shared-example`: Controls `13`, Actions `20`
- Business effect: `wallet_intent`
- Status: `usable-surface-present`

## Verification

- `npx vitest run test/neo-pay-shared-example.playarea.test.tsx`: 3 passed
- `npm --prefix apps/neo-pay-shared-example run build`: passed
- `node scripts/stage-miniapp-dists.mjs neo-pay-shared-example`: staged 1 app
- Browser desktop `1440x1100`: launch prefill, `90d NEO` preset, clear disabled state, filled create flow, route preview, no overflow
- Browser mobile `390x900`: same workflow, no overflow
- Browser diagnostics: `consoleErrors=[]`, `pageErrors=[]`, `requestFailures=[]`

Mocked local POST endpoints during browser run:

- `/api/edge/os-vesting-list`
- `/api/edge/os-payment-deposit`
- `/api/edge/os-vesting-create`

## Evidence

- Browser report: `docs/reports/neo-pay-shared-example-shared-runtime-after/browser-report.json`
- Desktop screenshot: `docs/reports/neo-pay-shared-example-shared-runtime-after/desktop.png`
- Mobile screenshot: `docs/reports/neo-pay-shared-example-shared-runtime-after/mobile.png`
- Updated catalog audit: `docs/reports/miniapp-playarea-functionality-latest.md`
