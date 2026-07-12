# AA Relay Console Production Status

Date: 2026-07-11

## Status

The request preparation, on-chain preview, digest-bound receipt import, local recovery, and chain verification paths are production-oriented and fail closed. Direct relay submission is intentionally **not enabled** in this MiniApp runtime.

| Capability | Status | Evidence boundary |
| --- | --- | --- |
| Canonical V3 request validation | Ready | Network AA Core, supported method, argument layout, account binding, target, nonce, deadline, and parameter bounds are validated locally. |
| Safe AA Core preview | Ready | Uses `invokefunction` → `previewUserOpValidation`; preview does not claim signature or target execution validity. |
| Review package | Ready | Stable SHA-256 digest and job ID bind network, AA Core, account, and normalized meta invocation. |
| Direct relay submit | Deliberately unavailable | The MiniApp runtime exposes no verifiable authenticated submit capability or status/readback API. No POST is issued. |
| Sponsorship check | Conditional | Read-only only; incomplete, zero-shaped, forbidden, or failed responses are shown as unavailable, not eligible. |
| Sponsorship request | Not exposed | No authenticated state-changing request capability is proven for this runtime. |
| Receipt import | Ready | Requires matching network and package digest; malformed/short txids and unbound acceptance responses are rejected. |
| Transaction tracking | Ready | Reads both application log and raw transaction; confirms only a matching AA Core `UserOpExecuted` event. |
| Recovery | Ready | Persists one network-scoped job, receipt, and outcome locally; explicit launch accounts do not inherit a stale saved job, and recovered previews are marked stale until refreshed. |
| Automatic resubmission | Not implemented by design | A recovered job can be reviewed or tracked but is never silently resubmitted. |

## User-facing state meanings

- **Review ready**: the request is locally valid and current deadline/nonce preview passed. It still requires account authorization and an external authorized relay.
- **Authorization required**: the preview found a configured verifier but the package has no verifier signature bytes.
- **Preview unavailable**: local validation passed, but the current RPC preview could not be proven.
- **Relay accepted only**: a durable relay request ID exists, but there is no broadcast txid.
- **Broadcast pending**: a valid txid exists, but the chain has not produced a confirmable matching receipt.
- **Confirmed UserOp**: the transaction halted successfully and emitted the expected event bound to the review package.
- **Execution fault / receipt mismatch**: the chain evidence is authoritative; the UI does not convert these into success.

## Remaining deployment decision

To enable in-app submission later, the platform must provide a current authenticated relay capability plus a durable status/readback API that binds request ID, network, package digest, and eventual txid. Enabling a POST button without that contract would regress the product back to unverifiable acceptance.

## QA boundary

This iteration includes source, type, lint, 17/17 focused unit/component tests,
production build, contract/RPC, and non-browser HTTP verification. The runtime
now prefers the explicit host launch network over URL fallback, and persisted
receipts must retain normalized status and timestamp evidence before restore.

The production build transformed 1,852 modules. The app entry is 209.02 kB
(63.33 kB gzip), OpenUiLite vendor is 32.65 kB (11.61 kB gzip), and CSS is
100.99 kB (18.43 kB gzip). All 16 emitted files returned HTTP 200.

Browser automation, screenshots, deployment, wallet signing, and funded
transactions were explicitly outside this work lane.
