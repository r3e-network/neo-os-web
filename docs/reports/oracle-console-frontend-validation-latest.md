# Oracle Console Frontend Validation

Generated: 2026-06-01
Network: Neo N3 testnet
Scope: Oracle HTTP Console, Oracle VRF Console, Oracle Price Console

## Result

- PASS: Host Oracle HTTP action now has a default endpoint and produces a visible `oracle.http.request` package.
- PASS: Host Oracle VRF action now uses `consumer`, `salt`, `rounds`, and `mode` instead of the old generic endpoint shape.
- PASS: Host Oracle VRF no longer shows or submits the HTTP health endpoint as a randomness request.
- PASS: Host Oracle Price action keeps the clean `GAS-USD` display while producing a visible `oracle.price.request` package.
- PASS: Embedded Oracle VRF dApp has usable defaults and builds a ready VRF payload without "required fields missing".
- PASS: Embedded Oracle Price dApp consumes `symbol=TWELVEDATA:GAS-USD`; the frontend showed `GAS/USD` and loaded a testnet price.
- PASS: Desktop and mobile browser checks reported no bad responses, no page errors, no console errors, and `overflowX: 0`.

## Fixes

- Made the host Oracle result verifier visible in the primary console surface instead of hiding it inside a collapsed details section.
- Added mode-specific host payload builders for HTTP, VRF, and Price requests.
- Added an HTTP endpoint default to the Oracle HTTP manifest operation.
- Replaced Oracle VRF's generic `endpoint` operation param with `consumer`, `salt`, `rounds`, and `mode`.
- Added standalone Oracle VRF defaults so the embedded dApp button works immediately.
- Added Oracle Price launch-param parsing so `asset`, `symbol`, `feed`, or `endpoint` can preselect NEO/GAS/BTC.

## Evidence

- Desktop HTTP screenshot: docs/reports/oracle-http-console-action-after.png
- Desktop VRF screenshot: docs/reports/oracle-vrf-console-action-after.png
- Desktop Price host screenshot: docs/reports/oracle-price-console-action-after.png
- Embedded VRF screenshot: docs/reports/oracle-vrf-console-embedded-default-after.png
- Embedded Price screenshot: docs/reports/oracle-price-console-embedded-launch-after.png
- Mobile VRF host screenshot: docs/reports/oracle-vrf-console-mobile-action-after.png
- Tests: `cd platform/host-app && npm test -- --runInBand __tests__/components/PlayAreaRegistry.test.tsx __tests__/lib/miniapp-template.test.ts __tests__/lib/miniapp-runtime.test.ts`
- Typecheck: `cd platform/host-app && npm run typecheck`
- Build: `npm run build:miniapp-dapps -- oracle-http-console oracle-vrf-console oracle-price-console`
- Stage: `npm run stage:miniapps:dist -- oracle-http-console oracle-vrf-console oracle-price-console`

## Browser Runs

Host desktop:

- Oracle HTTP: `Build Request` updated the URL with `operation=buildOraclePackage`, showed `oracle.http.request`, and had no required-field error.
- Oracle VRF: `Build VRF Request` updated URL params with consumer/salt/rounds/mode, showed `oracle.vrf.request`, and did not include the HTTP health endpoint.
- Oracle Price: `Build Feed Request` with `symbol=TWELVEDATA:GAS-USD` showed `oracle.price.request` and `GAS-USD`.

Embedded dApps:

- Oracle VRF: `Build VRF Request` showed `VRF request ready` and an `oracle.vrf.request` payload with default consumer and salt.
- Oracle Price: `Fetch Price` on `symbol=TWELVEDATA:GAS-USD` showed `GAS/USD` and a fresh testnet feed result.

Mobile:

- Oracle VRF: opened the mobile action drawer, submitted `Build VRF Request`, saw `oracle.vrf.request`, no required-field error, and `overflowX: 0`.

## Next Signals

- Agent-team sidecar scan ranks Forever Album storage/kernel method mismatch and Gas Lucky Pool OneGate payout backend readiness as the next highest MiniApps-platform issues.
- Sidecar AA/Oracle repo scan ranks Morpheus Oracle request-fee preflight and AA Studio `.matrix` domain check parameter order as high-impact cross-repo frontend action issues.
