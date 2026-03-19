# 2026-03-19 Frontend-Only MiniApp Structure Validation

## Scope

Validated the current frontend-only / launcher / console miniapps that do not ship an app-specific Neo N3 contract hash in their manifest.

Count: `24`

## Checks performed

1. `neo-manifest.json` exists and has a frontend entry route
2. `src/pages/index/index.vue` exists
3. page shell uses one of the approved shared layouts:
   - `MiniAppPage`
   - `OfficialLauncherMiniApp`
   - `ConsoleMiniApp`
4. host application production build succeeds
5. global layout audit across all 52 miniapps succeeds

## Result

- frontend-only pages with valid page entry: `24 / 24`
- frontend-only pages using approved shared layout shell: `24 / 24`
- host app production build: `PASS`
- global miniapp layout audit: `PASS`

## Covered frontend-only miniapps

- `aa-account-lab`
- `aa-market-hub`
- `aa-permissions-lab`
- `aa-relay-console`
- `aa-session-key-lab`
- `explorer`
- `flamingo-action-center`
- `flamingo-analytics`
- `flamingo-earn`
- `flamingo-lend`
- `flamingo-swap`
- `neo-convert`
- `neo-multisig`
- `neo-sign-anything`
- `neo-treasury`
- `neo-x-bridge`
- `oracle-compute-lab`
- `oracle-http-console`
- `oracle-neodid-console`
- `oracle-price-console`
- `oracle-seal-console`
- `oracle-vrf-console`
- `timestamp-proof`
- `wallet-health`

## Notes

- This validates structure, manifest routing, shared layout conformance, and host build compatibility.
- It does not prove external protocol uptime for third-party launcher targets such as Flamingo or the official bridge.
- It does not replace wallet-driven UX smoke tests inside a browser runtime.
