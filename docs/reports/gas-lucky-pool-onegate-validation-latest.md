# OneGate Vault Frontend Validation

Scope: `gas-lucky-pool` / OneGate Vault recipient claim flow, host action console, mobile QR launch layout, and backend claim handoff.

## What Changed

- Kept OneGate claim failures inside the claim card instead of duplicating a long global toast.
- Split diagnostic strings into a compact code block so support data remains visible without wrecking the page.
- Moved mobile claim content to the top of the first viewport instead of vertically centering it below a large blank area.
- Removed the misleading `GAS received` step from failed claim progress.
- Reworked the host Action Console so users can scan a OneGate QR or manually paste a claim key. The claim key is visible, required, and marked sensitive so it clears after a successful submit.
- Added an optional `Pool ID` field and hidden `oneGateAppId=23` context to the platform operation schema so QR aliases and manual recovery claims reach the same backend payload shape.

## Browser Evidence

- Host Action Console manual claim: `docs/reports/onegate-vault-claim-flow-after/browser-report.json`
  - Desktop before submit: `docs/reports/onegate-vault-claim-flow-after/desktop-before-submit.png`
  - Desktop after submit: `docs/reports/onegate-vault-claim-flow-after/desktop-after-submit.png`
  - Without a QR key, the host form shows `Claim key` and `Pool ID`; `Claim Reward` is not disabled and has no QR-only title.
  - Submitting with a mocked NEP-21 OneGate provider posted to `/api/onegate-vault/claim` with `claimKey=ogv_playwright_user_key`, address `NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu`, `network=testnet`, `poolId=pool-001`, `oneGateAppId=23`, and `appId=miniapp-gas-lucky-pool`.
  - The mocked paid response rendered success feedback and cleared the sensitive claim key while preserving the pool id.
  - Desktop layout: no horizontal overflow and no overflowing operation controls.
- Mobile host Action Console QR alias: `docs/reports/onegate-vault-claim-flow-after/mobile-action-sheet.png`
  - `key=ogv_mobile_alias_key` and `pool=pool-mobile` launch params prefilled `Claim key` and `Pool ID`.
  - The mobile sheet shows `Reward ready`, `Claim Reward` is enabled, and the 390px viewport has no horizontal overflow.
- Mobile OneGate claim without provider: `docs/reports/gas-lucky-pool-onegate-final-error.png`
  - Heading top: `46.8125px`.
  - No app toast duplication.
  - No root status toast duplication.
  - Failed progress labels: `Wallet ready`, `Submitting claim`, `Waiting for GAS transfer`.
  - Diagnostic POST reached `/api/onegate-vault/diagnostics` and returned `202`.
- Mobile claim with mocked OneGate provider: `docs/reports/gas-lucky-pool-onegate-provider-error-after.png`
  - Frontend posted claim body to `/api/onegate-vault/claim` with address `NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu`, `network=testnet`, `poolId=pool-001`, `oneGateAppId=23`, `appId=miniapp-gas-lucky-pool`.
  - Backend returned `500 CONFIG_ERROR`: `Supabase service role is required for OneGate Vault claims`.

## Verification Commands

- `cd apps/shared && npx vitest run test/gas-lucky-pool.playarea.test.tsx test/gas-lucky-pool.logic.test.ts test/gas-lucky-pool.pool-actions.test.ts test/gas-lucky-pool-copy.test.ts test/miniapp-operation-panel.launch-params.test.tsx`
- `npm --prefix platform/host-app test -- __tests__/components/OperationPanel.test.tsx --runInBand`
- `npm --prefix platform/host-app test -- __tests__/lib/miniapp-definitions.test.ts __tests__/lib/miniapp-detail-helpers.test.ts __tests__/hooks/useMiniAppDetailInvoke.test.tsx --runInBand`
- `npm --prefix apps/gas-lucky-pool run build`
- `npm --prefix platform/host-app run typecheck`
- `npm run -s stage:miniapps:dist`
- `npm --prefix platform/host-app run build`

## Remaining Blocker

No real testnet payout transaction was produced in this slice because the local OneGate Vault backend still needs the Supabase service role configuration used by `/api/onegate-vault/claim`. The frontend handoff is verified up to the service boundary, including wallet address collection, claim payload, success rendering, sensitive-key clearing, and mobile QR alias prefill.
