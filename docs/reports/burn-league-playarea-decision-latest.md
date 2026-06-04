# Burn League PlayArea Decision Desk Validation

Generated: 2026-06-02T09:40:00+08:00

## Scope

This slice focused on `miniapp-burn-league`, the lowest-control active PlayArea row after the previous Dice Game pass. The goal was to make the frontend more useful before wallet signing: users should understand the burn amount, projected leaderboard impact, reward model, and confirmation path instead of seeing only a basic burn form.

No WIF or private key was used in this slice. Browser validation operated the staged frontend bundle and mocked only local static-server POST responses because `python http.server` cannot serve `/api/edge/*`.

## Changes

- Added season status, projected rank, and reward model decision cards.
- Added frontend burn range validation (`1-1000 GAS`) with inline error copy.
- Added a fourth preset (`25 GAS`) and a `Reset` control back to the minimum safe entry.
- Added projected rank to the impact grid.
- Added a burn review checklist: confirm amount, review rank impact, sign wallet intent.
- Improved leaderboard rows by separating burned amount from the metric label.
- Replaced placeholder-feeling status copy with business state copy (`Data pending` when live stats are unavailable).
- Extended PlayArea tests for reset, invalid amount blocking, decision copy, and existing preset/leaderboard behavior.

## Verification

- `npx vitest run test/burn-league.playarea.test.tsx test/burn-league.logic.test.ts`: 9 passed
- `npm --prefix apps/burn-league run build`: passed
- `npm run -s audit:miniapps:playareas`: 60 miniapps, 0 catalog-level PlayArea gaps
- `node scripts/stage-miniapp-dists.mjs burn-league`: staged 1 app
- Browser desktop `1440x1100`: launch amount, `25 GAS` preset, reset, invalid `1001` block, valid `10` restore, burn flow, no overflow
- Browser mobile `390x950`: same workflow, no overflow
- Browser diagnostics: `consoleErrors=[]`, `pageErrors=[]`, `requestFailures=[]`

Current audit row:

- `miniapp-burn-league`
- Controls: `5` static JSX signals
- Actions: `10`
- Business effect: `wallet_intent`
- Status: `usable-surface-present`

Mocked local POST endpoints during browser run:

- `/api/edge/os-game-status`
- `/api/edge/os-leaderboard-get`
- `/api/edge/os-game-bet`
- `/api/edge/os-badge-update-stat`
- `/api/edge/os-badge-award`
- `/api/edge/os-leaderboard-submit`

## Evidence

- Browser report: `docs/reports/burn-league-playarea-decision-after/browser-report.json`
- Desktop screenshot: `docs/reports/burn-league-playarea-decision-after/desktop.png`
- Mobile screenshot: `docs/reports/burn-league-playarea-decision-after/mobile.png`
- Updated catalog audit: `docs/reports/miniapp-playarea-functionality-latest.md`
