# Daily Check-in PlayArea Decision Polish

Checked: 2026-06-02

## Scope

- Miniapp: `apps/daily-checkin`
- Focus: frontend polish, business completeness, check-in/claim decision clarity, service route evidence, desktop/mobile layout.
- Real testnet transaction: not executed in this slice. Browser validation operated the frontend against mocked OS edge boundaries to verify the runtime call path without using or exposing WIF material.

## Changes

- Added a `Today plan` decision panel that explains the UTC check-in window, milestone reward impact, claimability, and OS service route before the user clicks a wallet action.
- Split the decision state into business tiles for daily window, milestone impact, and claim plan so the page is no longer just statistics plus buttons.
- Added a compact checklist for UTC availability, visible check-in fee, and claimable balance.
- Fixed the post-check-in milestone state so day 7 renders as `Day 7 secured` instead of continuing to show the pre-check-in reward prompt.
- Added localized copy for the secured milestone and post-check-in milestone states.
- Updated the Daily Check-in PlayArea test to cover the new decision panel, visible actions, and service-route copy.

## Verification

- `npx vitest run test/daily-checkin.playarea.test.tsx test/daily-checkin.logic.test.ts` from `apps/shared`: 6 tests passed.
- `npm --prefix apps/daily-checkin run build`: passed.
- `node scripts/stage-miniapp-dists.mjs daily-checkin`: staged 1 app, catalog count 60.
- `npm run audit:miniapps:playareas`: audited 60 miniapps, 0 catalog-level PlayArea gaps.
- `git diff --check` on touched Daily Check-in files and the new test: passed.
- Playwright frontend operation on staged `http://127.0.0.1:4230/miniapps/daily-checkin/index.html?network=testnet`:
  - Initial load reached `/api/edge/os-checkin-streak`.
  - `Refresh Status` reached `/api/edge/os-checkin-streak` and settled the status pill.
  - `Check In Now` reached `/api/edge/os-checkin-checkin` and updated the UI to `Day 7 secured`.
  - `Claim Rewards` reached `/api/edge/os-checkin-claim`, rendered `Reward claimed`, and changed the claim plan to `Nothing to claim`.
  - Desktop and mobile had no horizontal overflow, raw OS boundary errors, `undefined`, or `NaN` text.

## Evidence

- Browser report: `docs/reports/daily-checkin-plan-after/browser-report.json`
- Desktop ready screenshot: `docs/reports/daily-checkin-plan-after/desktop-ready.png`
- Desktop after-claim screenshot: `docs/reports/daily-checkin-plan-after/desktop-after-claim.png`
- Mobile ready screenshot: `docs/reports/daily-checkin-plan-after/mobile-ready.png`
