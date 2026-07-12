# Oracle HTTP Console

Oracle HTTP Console is a visual payload builder for Morpheus HTTP oracle intents. The first screen is a source → extractor → draft-package pipeline; method, URL, extraction path and optional POST JSON remain in the compact Details drawer.

## Core flow

1. Choose GET or POST and enter a public HTTP(S) source.
2. Enter the extraction path Morpheus actually executes, such as `status` or `data.0.price`.
3. For POST, optionally add valid JSON. The copied payload automatically includes `content-type: application/json`.
4. Prepare the payload, review the network-bound SHA-256 draft digest, then copy the exact `MorpheusHttpPayload` from the receipt drawer.

The builder accepts familiar paths such as `$.data[0].price` and normalizes them to the runtime form `data.0.price`. Recursive descent, filters and wildcards are rejected because the current Morpheus worker does not execute those JSONPath features.

## Product boundary

- The MiniApp builds, validates, hashes and copies a draft locally. It does not fetch the source, bind a callback, submit a transaction or claim an oracle result.
- The payload is bound to the selected launch network and canonical `/oracle/smart-fetch` route from the shared Morpheus registry.
- GET omits the body. POST accepts at most 32 KiB of valid JSON and preserves its exact bytes in the digest and copied payload.
- Credentials, URL fragments, local hosts and literal private-network addresses are rejected because the remote oracle lane cannot use them as entered. Final DNS resolution and endpoint policy still happen in Morpheus at execution time.
- The SHA-256 value identifies this local network + route + payload draft. It is not a worker signature, callback receipt or proof that the oracle ran.
- No wallet or blockchain permission is requested; Reset clears the local draft tally and receipt.

Actual execution starts only when a separate callback-binding workflow submits the copied payload. Current public service readiness is documented in `NETWORK_STATUS.md`.

## Verification

```bash
npx tsc -p apps/oracle-http-console/tsconfig.json --noEmit --incremental false
npx eslint apps/oracle-http-console/src apps/shared/test/oracle-http-console.config.test.ts apps/shared/test/oracle-http-console.integration.test.tsx apps/shared/test/oracle-http-console.playarea.test.tsx
```

From `apps/shared`:

```bash
npm exec vitest -- run test/oracle-http-console.config.test.ts test/oracle-http-console.integration.test.tsx test/oracle-http-console.playarea.test.tsx test/console-kernel.test.tsx
```
