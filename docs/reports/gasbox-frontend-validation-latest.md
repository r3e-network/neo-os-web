# GasBox Frontend Validation

Date: 2026-06-01

Scope: GasBox host action console, embedded dApp launch handling, desktop and mobile frontend behavior on Neo N3 Testnet.

## Finding

The host action previously displayed `Draw Capsule`, but used the frontend-local `prepareMiniAppOperation` path. Clicking it only updated launch query parameters (`machine=1&draws=1`) and reloaded the iframe; it did not dispatch a GasBox pull, show a wallet flow, or make the embedded dApp select a machine.

Evidence captured before the fix:

- `docs/reports/gasbox-host-action-before.png`
- `docs/reports/gasbox-host-action-before-clicked.png`

## Fix

- Renamed the host operation to `Open Draw Console`.
- Removed the unsupported `draws` parameter from the host fallback.
- Replaced the required legacy `machine=1` default with an optional `machineId` field.
- Added GasBox launch selection logic so the embedded dApp consumes `machineId`, `machine`, `machine_id`, or `id`.
- Preserved legacy numeric `machine=1` behavior as a one-based machine index when exact IDs are unavailable.
- Added clear dApp status messages for selected, missing, and unavailable-machine states.
- Removed a nested card inside the GasBox market panel for a cleaner, more stable layout.

## Frontend Result

The host action now honestly opens/prepares the embedded dApp draw surface. With no machine ID, it focuses the draw console and tells the user that no GasBox machines are currently available. With `machine=1`, the dApp consumes the parameter and reports that the requested machine is not present in the live market.

Because the live testnet market currently returned no active machines, no real GasBox draw transaction was submitted in this slice. The UI no longer implies a transaction happened when only launch parameters were applied.

Evidence captured after the fix:

- `docs/reports/gasbox-host-open-draw-after.png`
- `docs/reports/gasbox-host-open-draw-clicked-after.png`
- `docs/reports/gasbox-embedded-launch-after.png`
- `docs/reports/gasbox-mobile-open-draw-after.png`
- `docs/reports/gasbox-mobile-open-draw-clicked-after.png`

## Verification

Passed:

- `cd platform/host-app && npm test -- --runInBand __tests__/components/PlayAreaRegistry.test.tsx __tests__/lib/miniapp-launch-params.test.ts`
- `cd apps/shared && npx vitest run test/gasbox.launch.test.ts`
- `cd platform/host-app && npm run typecheck`
- `npm run build:miniapp-dapps -- gasbox`
- `npm run stage:miniapps:dist -- gasbox`

Playwright desktop and mobile checks passed with no console or page errors:

- Desktop action console showed `Open Draw Console`, no unsupported `draws` field, and no fake transaction state.
- Desktop click updated the iframe to `operation=prepareMiniAppOperation` and showed the dApp warning about unavailable machines.
- Direct embedded launch with `machine=1` showed `Machine 1 was not found in the live market`.
- Mobile action drawer showed the same operation, optional `Machine ID` field, and clean responsive layout.
