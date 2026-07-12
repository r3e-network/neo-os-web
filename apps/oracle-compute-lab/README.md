# Oracle Compute Lab

Oracle Compute Lab is a warm, resource-led workbench for preparing a Morpheus compute request. The product has one primary task: validate JSON source data and produce a SHA-256-bound local request package for review.

## Product flow

1. **Source** — edit JSON in the secondary drawer. The main stage shows its shape and byte size, not a survey-style wall of inputs.
2. **Policy** — choose an intent preset and whether the package should omit the raw source or include deliberately public JSON.
3. **Request package** — the app canonicalizes the parsed JSON and produces real 64-hex-character SHA-256 source and request digests. The request digest binds the payload to the selected checked-in network and route snapshot.
4. **Runtime boundary** — the app explicitly stops before dispatch. It does not report a result, proof, attestation, job ID, transaction, or callback.

The intent presets (`risk-signal`, `proof-review`, and `batch-transform`) are request-planning metadata. They are not separate Morpheus workflows. The actual checked-in runtime workflow reference is `compute.execute` at `/compute/execute`.

## Privacy model

- **Keep source local** omits raw JSON from the local package and includes only `inputDigest`.
- Omission is **not encryption**. The package records `encryption: "none"` and `dispatchReady: false`.
- **Include public source** embeds parsed JSON only after explicit selection.
- The stage badge changes with the selected disclosure policy, so the public-source option never claims the raw value remains local.
- Source data is held in React component memory; this app does not persist it.

## What is production-ready

- designed responsive workbench using the shared MiniApp OS v2 components;
- real repository-owned compute-stage art with high-contrast foreground UI;
- strict JSON, complete-value 64 KB, and 64-level nesting validation;
- finite-number and exact-safe-integer validation, preventing JSON parsing from
  silently changing a value before it is hashed or copied;
- canonical JSON ordering and Web Crypto SHA-256 digests, with no checksum fallback;
- one top-level request digest covering the exact returned payload and registry
  snapshot, without an unhashed self-referential digest field inside payload;
- network/route-bound request digests, so otherwise identical mainnet and testnet packages cannot share an identity;
- stale-package invalidation after source/policy changes;
- latest-result-wins handling for overlapping or late local hashing;
- exact local package copy action;
- bilingual product and boundary copy;
- no generic manifest operation forms and no unused platform capability requests.

## What is intentionally unavailable

This release is not a runtime dispatch client. `/compute/execute` requires authenticated Morpheus integration, and this MiniApp does not hold or solicit a runtime credential. It therefore does not create a job ID or make a network write.

Because no write exists, `pending`, `retry`, and `readback` are `not_applicable`. A future dispatch implementation must persist the returned job ID before leaving the submit step, poll/read by that ID, and retry readback rather than executing the compute request again.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for current read-only runtime/contract evidence and [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for the shipped boundary.

## Development

From `apps/oracle-compute-lab`:

```bash
npm run build
npx tsc --noEmit
```

Focused shared tests run from `apps/shared`:

```bash
npx vitest run oracle-compute-lab
```

The app supports `?network=mainnet` and `?network=testnet` only as registry target selection. It does not present that selection as a live health verdict.
