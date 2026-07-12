# Oracle Seal Console

Oracle Seal Console is a focused confidential-payload workbench for Neo N3 and the Morpheus Oracle seal lane. The main screen is a bright seal chamber with one visible prepare → seal → receipt journey; purpose selection is compact, while the public route, private JSON editor, full receipt, and diagnostics stay in the detail drawer.

## Real product path

1. validate a non-empty JSON object in component memory;
2. require working device recovery storage before encryption;
3. fetch a fresh network-specific Oracle X25519 key through the platform route;
4. require the same-origin host to report a configured server-to-server confidential-store capability for that exact network;
5. independently read the selected Neo N3 RPC and verify the `MorpheusOracle` contract name, key, and algorithm without requiring a wallet;
6. encrypt locally with `X25519-HKDF-SHA256-AES-256-GCM`;
7. durably persist the exact ciphertext and verify the write before the first external store request;
8. accept a receipt only when storage returns a valid, non-zero reference;
9. mark the pending journal as already stored before saving receipt history and clearing recovery state.

One cross-action coordinator covers readiness checks, new seals, exact retries, and device cleanup. Duplicate readiness checks join one request, while conflicting actions cannot race state. A failed store retries the same ciphertext only after recomputing and matching its SHA-256 fingerprint. If a store response already returned but local cleanup was interrupted, the primary action becomes `Finish receipt cleanup`; it never sends the ciphertext again.

## Data and result boundary

- Source JSON remains in React component state. It is never written to local recovery, public metadata, or receipt history.
- Device recovery stores only a validated framework-v2 ciphertext envelope, its real SHA-256 fingerprint, public routing metadata, network/contract identity, and retry state.
- Every pending write, receipt-history write, and delete is read back before the UI treats it as durable.
- An unreadable recovery record is blocked from sending and must be explicitly cleared.
- A storage reference is not a Neo transaction, execution result, settlement, ZK proof, TEE attestation, or proof of account ownership.
- This MiniApp has no wallet connection, signature, token amount, fee, or on-chain transaction path.

## Network and external-service boundary

The launch URL selects MainNet or TestNet before the framework seal client is created. The app then compares the platform public-key response with an independent read from the selected canonical N3Index RPC and pinned MorpheusOracle contract.

The service routes are:

- `GET /api/morpheus/oracle/public-key?network={mainnet|testnet}`
- `GET /api/morpheus/confidential/store?network={mainnet|testnet}` for a non-mutating capability check
- `POST /api/morpheus/confidential/store`

The checked-in store proxy handles opaque-frame CORS and forwards a
server-only configured project slug and store credential. If either is absent,
the capability check stays unavailable and the MiniApp does not encrypt or
send a new packet. The route exposes no ciphertext readback contract, so the
returned reference is presented only as a storage routing receipt, never as
ownership or retrieval proof. Upstream `inline_fallback` responses are rejected
and the exact local ciphertext remains recoverable.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for current read-only service evidence and the remaining deployment gate.

## Local validation

From the repository root:

```sh
npx vitest run apps/shared/test/oracle-seal-console.config.test.ts apps/shared/test/oracle-seal-console.seal.test.ts apps/shared/test/oracle-seal-console.production.test.ts apps/shared/test/oracle-seal-console.playarea.test.tsx apps/shared/test/oracle-seal-console.integration.test.tsx apps/shared/test/console-kernel.test.tsx --config apps/shared/vitest.config.ts --maxWorkers=1 --testTimeout=20000
(cd apps/shared && npx vitest run test/stateful-manifest-truth.test.ts --config vitest.config.ts --maxWorkers=1)
node --test deploy/scripts/lib/oracle_seal_console_frontend_structure.test.mjs
npx tsc -p apps/oracle-seal-console/tsconfig.json --noEmit
npx eslint apps/oracle-seal-console/src apps/shared/test/oracle-seal-console*.test.ts apps/shared/test/oracle-seal-console*.test.tsx apps/shared/test/console-kernel.test.tsx
npm --prefix apps/oracle-seal-console run build
```

Browser/Playwright validation, deployment, wallet operations, and live
confidential-store writes were not performed. The verified static MiniApp was
synchronized to the checked-in host bundle; that does not imply a live host or
Morpheus service deployment.
