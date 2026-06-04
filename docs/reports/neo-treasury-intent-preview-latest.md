# Neo Treasury Frontend Intent Preview Validation

Date: 2026-06-02

Scope:
- `miniapp-neo-treasury`
- Standalone miniapp runtime
- Host embedded miniapp detail runtime
- NEP-17 transfer intent preview, validation, and mocked NEP-21 invoke handoff

Changes validated:
- Added a signing intent panel before wallet submission.
- Shows native contract hash, fixed token amount, recipient Hash160, and signer state.
- Invalid recipient/amount blocks submission before wallet invocation.
- Empty-wallet state now says `Connect & Sign Disbursement` instead of a vague signing command.
- Kept public treasury watched wallets read-only while connected-wallet transfer remains explicit.

Browser validation:
- Valid standalone flow: opened `neo-treasury` with testnet launch params, verified `NEP-17 transfer ready`, clicked `Connect & Sign Disbursement`, and captured a mocked NEP-21 `transfer` invoke.
- Invalid standalone flow: opened with `recipient=bad-recipient`, verified validation copy, disabled submit, and zero wallet invokes.
- Mobile standalone flow: verified signing intent, fixed amount, new button label, and 0px horizontal overflow at 390x844.
- Host embedded flow: opened `/miniapp-detail/miniapp-neo-treasury`, verified iframe intent, clicked submit inside the embedded miniapp, and captured one mocked NEP-21 invoke.

Captured invoke:
- Contract: `0xd2a4cff31913016155e38e474a2c06d08be276cf`
- Operation: `transfer`
- Args: sender Hash160, recipient Hash160, `10000000`, memo `ops`

Evidence:
- `docs/reports/neo-treasury-intent-preview-after/browser-report.json`
- `docs/reports/neo-treasury-intent-preview-after/standalone-valid-submitted.png`
- `docs/reports/neo-treasury-intent-preview-after/standalone-invalid-blocked.png`
- `docs/reports/neo-treasury-intent-preview-after/standalone-mobile-valid.png`
- `docs/reports/neo-treasury-intent-preview-after/host-embedded-submitted.png`

Automated checks:
- `npx vitest run test/neo-treasury.logic.test.ts test/neo-treasury.playarea.test.tsx`
- `npm --prefix apps/neo-treasury run build`
- `npm --prefix platform/host-app test -- __tests__/lib/miniapp-detail-helpers.test.ts __tests__/components/OperationPanel.test.tsx --runInBand`
- `npm --prefix platform/host-app test -- __tests__/components/PlayAreaOracle.test.tsx __tests__/components/PlayAreaRegistry.test.tsx --runInBand`
- `npm --prefix platform/host-app run typecheck`
- `npm run -s audit:miniapps:playareas`

Catalog audit result:
- 60 active miniapps audited.
- 60 UI workflow surfaces present.
- 0 catalog-level PlayArea gaps.

Transaction note:
- This slice validates frontend operation and NEP-21 invoke construction with a mocked provider.
- It does not broadcast a funded testnet transaction.
