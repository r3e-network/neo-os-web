# Graveyard PlayArea Review Polish

Checked: 2026-06-02

## Scope

- Miniapp: `apps/graveyard`
- Focus: frontend polish, business completeness, input safety, record operations, mobile layout.
- Real testnet transaction: not executed in this slice. Browser validation operated the frontend against mocked OS edge boundaries to verify the runtime call path without using or exposing WIF material.

## Changes

- Added a burial review panel with hash quality, target preview, wallet action, and a pre-signing checklist.
- Added frontend gating for too-short content hashes so accidental fragments cannot reach the burial action.
- Added `Clear Hash` to reset the target and cancel an active confirmation.
- Added `Refresh Records` as a registered miniapp action wired to `loadAll()`.
- Added history guidance explaining that paid forgetting marks a follow-up state rather than deleting the audit trail.
- Adjusted review/checklist grids so desktop and mobile layouts do not squeeze labels or wrap into cramped tiles.
- Added `apps/shared/test/graveyard.playarea.test.tsx` for hash gating, clear/cancel, burial confirmation, refresh, and forgetting actions.

## Verification

- `npx vitest run test/graveyard.playarea.test.tsx` from `apps/shared`: 3 tests passed.
- `npm --prefix apps/graveyard run build`: passed.
- `node scripts/stage-miniapp-dists.mjs graveyard`: staged 1 app, catalog count 60.
- `npm run audit:miniapps:playareas`: audited 60 miniapps, 0 catalog-level PlayArea gaps.
- `git diff --check` on touched Graveyard files and the new test: passed.
- Playwright frontend operation on staged `http://127.0.0.1:4229/miniapps/graveyard/index.html`:
  - Short hash rendered validation copy and disabled `Review burial`.
  - Valid hash rendered the review panel and enabled confirmation.
  - `Review burial` opened the confirmation state.
  - `Bury on-chain` reached `/api/edge/os-nft-burn`.
  - `Refresh Records` reached `/api/edge/os-storage-list`.
  - `Forget` reached `/api/edge/os-storage-set` and updated a history record to `Forgotten`.
  - Desktop and mobile had no horizontal overflow, raw OS boundary errors, `undefined`, or `NaN` text.

## Evidence

- Browser report: `docs/reports/graveyard-playarea-review-after/browser-report.json`
- Desktop ready screenshot: `docs/reports/graveyard-playarea-review-after/desktop-ready.png`
- Desktop after-forget screenshot: `docs/reports/graveyard-playarea-review-after/desktop-after-forget.png`
- Mobile ready screenshot: `docs/reports/graveyard-playarea-review-after/mobile-ready.png`
