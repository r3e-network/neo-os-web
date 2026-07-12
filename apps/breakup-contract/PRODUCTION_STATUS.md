# Breakup Contract production status

Status: **frontend production closure complete; funded write QA not performed in this pass**

## Product surface

- The warm pact desk and existing ritual artwork remain the primary surface.
- One dominant CTA creates the reviewed pact. Setup, contract history, recovery credit, refresh, and lifecycle actions live in the details drawer.
- The entry imports dependency-light `OpenUiLite` controls and `PlayStage` directly; it does not pull the full v2 barrel.
- UI motion follows the real `actionPhase`. There is no timer-backed preview or synthetic busy state.

## Transaction invariants

- Recovery storage is write/read/delete-probed before any wallet write opens.
- Wallet network, configured contract, and canonical manifest binding must match before writes.
- The `onTransactionSent` callback immediately persists the exact intent, network, contract, wallet hash, and normalized txid.
- A pending record ends only on an authoritative application-log `FAULT`, or on `HALT` plus the exact target-contract event plus a fresh authoritative contract readback.
- RPC timeout, missing transaction, missing event, partial read, or readback mismatch remains pending without an age-based escape hatch.
- Refresh only reconciles the saved record; it never replays the original action.
- `lastPactId` and credit read failures remain unavailable. Neither is coerced to zero.
- Partner address checksum, GAS fixed-8 amount, duration, pact ID, wallet, contract, and event parameters are validated before use.

## Verification gates

The focused handoff runs:

```bash
npx vitest run test/breakup-contract.production.test.ts test/breakup-contract.pending.test.ts
node --test deploy/scripts/lib/breakup_contract_frontend_structure.test.mjs
npx tsc -p apps/breakup-contract/tsconfig.json --noEmit
npx eslint apps/breakup-contract/src apps/shared/test/breakup-contract.production.test.ts apps/shared/test/breakup-contract.pending.test.ts
npm --prefix apps/breakup-contract run build
```

The built `dist/` is additionally served over a local static HTTP server and fetched without browser automation.

Latest local result: `49/49` focused tests passed; the app-specific structure
gate, TypeScript, scoped ESLint, and whitespace validation passed. The
production build transformed 1,854 modules and emitted a 221.31 kB app entry
(67.72 kB gzip). All `15/15` emitted files returned HTTP 200.

The verified `dist/` was copied to the host miniapp directory and is
byte-identical. The host catalog contains 77 entries, 77 unique app IDs, and one
`miniapp-breakupcontract` entry at version `1.1.0`.

## Release boundary

This closure does not claim a fresh funded mainnet or testnet transaction. It does not deploy or upgrade contracts. See `NETWORK_STATUS.md` for the read-only evidence and `ASSET_PROVENANCE.md` for the artwork inventory.
