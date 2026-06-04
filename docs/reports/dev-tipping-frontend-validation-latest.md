# Dev Tipping Frontend Validation

Generated: 2026-06-02T00:09:56.226Z

## Result

PASS. Dev Tipping now keeps loaded statistics in sync, communicates the manual Developer ID fallback clearly, and submits the host Action Console tip flow through the wallet invocation path with the expected testnet payload.

## Changes Validated

- `apps/dev-tipping/src/main.tsx`
  - `loadData()` now updates `developerCount`, `totalDonatedDisplay`, and `recentTipCount` after developer/tip storage loads.
  - `totalDonatedDisplay` defaults to `0 GAS` instead of a bare `0`.
- `apps/dev-tipping/src/PlayArea.tsx`
  - The hero falls back to live `totalDonated` when a stale zero display would hide a loaded value.
- `apps/dev-tipping/src/locale/messages.ts`
  - Empty-state copy now tells users they can enter a registered Developer ID directly.
- `platform/host-app/components/features/notifications/NotificationDropdown.tsx`
  - Mobile notification dropdown is constrained inside the viewport to avoid horizontal overflow.

## Browser Evidence

Report JSON: `docs/reports/dev-tipping-frontend-validation-after/browser-report.json`

Screenshots:

- `docs/reports/dev-tipping-frontend-validation-after/host-action-console-desktop.png`
- `docs/reports/dev-tipping-frontend-validation-after/standalone-empty-manual-id-desktop.png`
- `docs/reports/dev-tipping-frontend-validation-after/host-action-console-mobile.png`

Observed frontend behavior:

- Host URL: `http://localhost:3040/miniapps/dev-tipping?network=testnet`
- Wallet UI connected through a OneGate NEP-21 test provider.
- Action Console accepted Developer ID `7`, amount `0.05`, message, and tipper name.
- Submit button was enabled before submit.
- Success feedback included `0xdevtippingbrowser`.
- Desktop horizontal overflow: `0`, offenders: `[]`.
- Mobile horizontal overflow: `0`, offenders: `[]`.
- Embedded and standalone play areas both enable `Send Tip` after manual Developer ID + amount fields are filled.

Captured NEP-21 `provider.invoke` payload:

- GAS transfer:
  - hash `0xd2a4cff31913016155e38e474a2c06d08be276cf`
  - operation `transfer`
  - from `NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu`
  - to Dev Tipping testnet contract `0x389aa2c619f0cfed5b495dd8638107d20f37e086`
  - amount `5000000`
  - memo `miniapp-dev-tipping:tip`
- Dev Tipping contract call:
  - hash `0x389aa2c619f0cfed5b495dd8638107d20f37e086`
  - operation `tip`
  - devId `7`
  - amount `5000000`
  - message `Thanks for building`
  - tipper `Neo supporter`
- signer:
  - account `NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu`
  - scopes `CalledByEntry`

Note: this is a real frontend button-to-wallet invocation validation using a browser-injected OneGate-compatible NEP-21 provider. It did not broadcast a funded transaction to Neo N3 Testnet.

## Automated Verification

- `npx vitest run test/dev-tipping.playarea.test.tsx test/dev-tipping.setup.test.ts` from `apps/shared`: PASS, 3 tests.
- `npm --prefix platform/host-app test -- __tests__/hooks/useMiniAppDetailInvoke.test.tsx __tests__/lib/miniapp-definitions.test.ts --runInBand`: PASS, 48 tests.
- `npm --prefix apps/dev-tipping run build`: PASS.
- `npm run -s stage:miniapps:dist`: PASS, staged 60.
- `npm --prefix platform/host-app run typecheck`: PASS.
- `npm --prefix platform/host-app test -- __tests__/components/NotificationDropdown.test.tsx --runInBand`: PASS, 3 tests.
- `npm --prefix platform/host-app run build`: PASS.

Shared full `npx tsc -p apps/shared/tsconfig.json --noEmit` still has existing repository-wide type errors unrelated to this slice; filtered rerun showed no `dev-tipping` matches.
