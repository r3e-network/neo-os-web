# Unbreakable Vault Frontend Validation

Generated: 2026-06-01
Network: Neo N3 testnet
URL: /miniapps/unbreakable-vault?network=testnet

## Result

- PASS: The profiled MiniApp iframe resolves to `/miniapps/unbreakable-vault/index.html?network=testnet&source=embed`.
- PASS: The host detail page displays the Neo N3 testnet contract hash `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0`.
- PASS: Connected host `Create Vault` now resolves the generated catalog's top-level testnet contract hash and submits the NEP-21 invoke payload to `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0` instead of showing `Contract hash is not configured for this miniapp.`
- PASS: The embedded `Create Vault` button can be operated from the real frontend on desktop and mobile.
- PASS: The previous local no-edge failure is fixed: `/api/edge/os-payment-deposit` now returns `200` with a local wallet intent instead of a raw `500`.
- PASS: The iframe presents a clean wallet connection status: `Connect wallet from the top navigation before submitting embedded dApp actions.`
- PASS: Desktop validation reported no bad responses, no console errors, no page errors, and `overflowX: 0`.
- PASS: Mobile validation reported no bad `/api/edge` responses, no page errors, and `overflowX: 0`; a diagnostic rerun only observed aborted font/profile requests unrelated to the create flow.
- PASS: The escrow create edge function now accepts the frontend's `beneficiary` and milestones-array shape.
- NOTE: A live signed testnet transaction was not executed in this environment because no connected wallet or WIF/private key was available. The frontend now reaches the wallet-intent boundary cleanly.

## Fixes

- Added local wallet-intent fallbacks for `os-payment-deposit` and `os-escrow-create` in the host edge proxy when `EDGE_BASE_URL` is not configured.
- Normalized local fallback network selection from request body, referer query, or configured RPC network.
- Converted decimal GAS amounts to fixed8 integers for wallet invocation payloads.
- Made Unbreakable Vault tolerate string, object, txid, and pending escrow responses when deriving the created vault ID.
- Caught embedded create errors inside the PlayArea so users see a status message instead of an unhandled page error.
- Normalized generated catalog top-level `contracts` through host app coercion, network support checks, catalog availability, and detail-page contract resolution.
- Added regression coverage proving top-level `contracts.neo-n3-testnet` drives the Unbreakable Vault host action path.

## Evidence

- Desktop screenshot: docs/reports/unbreakable-vault-create-no-wallet-visible-after.png
- Mobile screenshot: docs/reports/unbreakable-vault-mobile-no-wallet-after.png
- Connected host action screenshots: docs/reports/unbreakable-vault-contract-hash-before-click.png, docs/reports/unbreakable-vault-contract-hash-after-click.png
- Connected host action JSON: docs/reports/unbreakable-vault-contract-hash-validation.json
- Previous failure screenshot: docs/reports/unbreakable-vault-create-before-click.png
- Tests: `cd platform/host-app && npm test -- --runInBand __tests__/lib/miniapp.test.ts __tests__/lib/miniapp-detail-helpers.test.ts`
- Typecheck: `cd platform/host-app && npm run typecheck`
- Build: `npm run build:miniapp-dapps -- unbreakable-vault`
- Stage: `npm run stage:miniapps:dist -- unbreakable-vault`

## Host Contract Hash Refresh

Generated: 2026-06-01 08:01 CST / 2026-06-01T00:00Z

- Connected mock NEP-21 wallet: `NMockFrontendAudit1111111111111111111`
- Submit state: enabled `Create Vault`
- Result: no `Contract hash is not configured` feedback, no console errors, no page errors, no bad responses.
- Captured invoke: `createVault` on `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0`

## Browser Runs

Desktop:

- Viewport: 1440 x 1100
- Edge responses: `200 /api/edge/os-storage-list`, `200 /api/edge/os-storage-list`, `200 /api/edge/os-payment-deposit`
- Bad responses: none
- Console/page errors: none
- Horizontal overflow: 0

Mobile:

- Viewport: 390 x 844
- Edge responses: `200 /api/edge/os-storage-list`, `200 /api/edge/os-storage-list`, `200 /api/edge/os-payment-deposit`
- Bad edge responses: none
- Page errors: none
- Horizontal overflow: 0
