# AA Relay Console

AA Relay Console is a warm, task-first operator workspace for preparing and recovering Neo N3 Abstract Account relay jobs. It does not expose the host's generic parameter form and it does not claim that a job was submitted, sponsored, broadcast, or executed without matching evidence.

## Product flow

1. **Prepare** — validate a canonical `UnifiedSmartWalletV3.executeUserOp` or `executeSponsoredUserOp` request and bind it to the selected network, AA Core, account, target, nonce, and deadline.
2. **Preview** — call the safe on-chain `previewUserOpValidation(accountId, op)` method. This checks deadline, nonce, and current verifier/hook bindings; it deliberately does not prove signature validity or target execution.
3. **Authorized submit** — hand the digest-bound review package to an independently authenticated relay operator. The MiniApp stops here because its runtime does not expose a verifiable authenticated relay capability or relay-status API.
4. **Receipt** — import an external receipt that carries the exact network and package digest. A receipt without a 32-byte txid is only an accepted relay job, never a broadcast transaction.
5. **Track and recover** — persist the current job locally, read `getapplicationlog` and `getrawtransaction`, and require a matching AA Core `UserOpExecuted(accountId, target, method, nonce)` event before reporting confirmation.

Only the current state action is primary. Advanced call data, paymaster scope, package JSON, and receipt import stay in the secondary job workspace.

## Supported request shape

The console accepts canonical V3 single-operation payloads only:

```json
{
  "metaInvocation": {
    "scriptHash": "0x<canonical-aa-core>",
    "operation": "executeUserOp",
    "args": [
      { "type": "Hash160", "value": "$AA_ACCOUNT" },
      {
        "type": "Struct",
        "value": [
          { "type": "Hash160", "value": "0x<target-contract>" },
          { "type": "String", "value": "methodName" },
          { "type": "Array", "value": [] },
          { "type": "Integer", "value": "0" },
          { "type": "Integer", "value": "<future Neo millisecond timestamp>" },
          { "type": "ByteArray", "value": "<verifier signature bytes>" }
        ]
      }
    ]
  }
}
```

`$AA_ACCOUNT` is the only supported template token. Preparation replaces it with the validated route account. Caller-supplied signers and raw transactions are rejected.

## Receipt contract

An imported operator receipt must be bound to the active package:

```json
{
  "network": "mainnet",
  "packageDigest": "0x<64 hex characters>",
  "status": "accepted",
  "requestId": "durable-operator-request-id",
  "txid": "0x<64 hex characters when broadcast>"
}
```

- `accepted`, `pending`, or `queued` without a txid requires a durable `requestId` and is shown only as relay acceptance.
- A txid must be exactly 32 bytes.
- Network or package-digest mismatches are rejected.
- `HALT` alone is insufficient: the expected `UserOpExecuted` event must match the prepared account, target, method, and nonce.

## Runtime boundaries

- The AA Core authorizes through its configured verifier plugin or backup-owner witness. A relay cannot authorize the account.
- Paymaster sponsorship funds execution; it does not authorize it.
- The shared MiniApp `AAService` can post to `/api/aa/relay`, but this app does not call it because the host proxy does not expose a verifiable authenticated capability or status endpoint to the MiniApp.
- Sponsorship checking remains read-only and secondary. An unavailable or incomplete response is not converted into eligibility.
- Non-idempotent relay and sponsorship requests are never retried or auto-resubmitted by this app.

See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md), [NETWORK_STATUS.md](./NETWORK_STATUS.md), and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).

## Verification

From the repository root:

```bash
npx tsc --noEmit -p apps/aa-relay-console/tsconfig.json
npx eslint apps/aa-relay-console/src apps/shared/test/aa-relay-console.*.test.ts apps/shared/test/aa-relay-console.*.test.tsx
npm --prefix apps/aa-relay-console run build
```

The focused Vitest files live under `apps/shared/test/aa-relay-console.*.test.*`.

Run them from the shared test root so its alias configuration is active:

```bash
cd apps/shared
npx vitest run test/aa-relay-console.logic.test.ts test/aa-relay-console.playarea.test.tsx test/aa-relay-console.integration.test.tsx --maxWorkers=1 --testTimeout=15000
```
