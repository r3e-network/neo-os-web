# GasBox PlayArea Decision Polish

Checked: 2026-06-02

## Scope

- Miniapp: `apps/gasbox`
- Focus: frontend polish, player-facing business logic, action completeness, mobile layout.
- Real testnet transaction: not executed in this slice. Browser validation used mocked OS edge boundaries to operate the frontend buttons and verify the runtime call path without exposing or using WIF material.

## Changes

- Added a selected-machine pull decision panel with readiness, GAS cost, inventory, prize focus, readable odds, and a pre-pull checklist.
- Added selected-machine operations for `Refresh Machines` and `Open Studio`, while preserving the existing `pull` action path.
- Disabled pull remains governed by `active && inventoryReady`, with clearer blocked-state copy.
- Removed the successful launch-selection toast so selected-machine content is not visually covered on desktop or mobile; warning toasts for missing launch targets remain.
- Added `apps/shared/test/gasbox.playarea.test.tsx` to cover ready and blocked frontend flows.

## Verification

- `npx vitest run test/gasbox.launch.test.ts test/gasbox.playarea.test.tsx` from `apps/shared`: 5 tests passed.
- `npm --prefix apps/gasbox run build`: passed.
- `node scripts/stage-miniapp-dists.mjs gasbox`: staged 1 app, catalog count 60.
- `npm run audit:miniapps:playareas`: audited 60 miniapps, 0 catalog-level PlayArea gaps.
- Playwright frontend operation on staged `http://127.0.0.1:4227/miniapps/gasbox/index.html?operation=prepareMiniAppOperation&machineId=gasbox-alpha`:
  - Loaded selected machine through the frontend launch path.
  - Clicked `Refresh Machines`, `Open Studio`, and `Pull`.
  - Reached `/api/edge/os-payment-deposit` and `/api/edge/os-game-bet`.
  - Rendered the pull result dialog.
  - Confirmed desktop/mobile had no horizontal overflow, raw OS boundary errors, `undefined`, `NaN`, or launch-success toast overlap.

## Evidence

- Browser report: `docs/reports/gasbox-playarea-decision-after/browser-report.json`
- Desktop ready screenshot: `docs/reports/gasbox-playarea-decision-after/desktop-ready.png`
- Desktop after-pull screenshot: `docs/reports/gasbox-playarea-decision-after/desktop-after-pull.png`
- Mobile ready screenshot: `docs/reports/gasbox-playarea-decision-after/mobile-ready.png`
