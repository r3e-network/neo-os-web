# Production Status

Status date: 2026-07-11

## Shipped product boundary

Oracle Compute Lab is production-ready as a **local request preparation and review tool**.

| Capability | Status | Product behavior |
| --- | --- | --- |
| JSON source validation | Ready | Rejects blank, malformed, deeper-than-64-level, larger-than-64-KB, non-finite, or unsafe-integer source before packaging. The byte limit covers the complete editor value, including padding. |
| Source/request binding | Ready | Uses canonical JSON plus Web Crypto SHA-256; the request digest covers both the payload and the selected checked-in network/route snapshot. |
| Digest-only disclosure | Ready | Raw source is omitted, while the package explicitly says `encryption: none`. |
| Public disclosure | Ready | Parsed source is included only after explicit selection. |
| Package copy | Ready | Copies the exact formatted local package. |
| Late-result handling | Ready | Editing invalidates in-flight hashing, and an older overlapping result cannot replace the newest package. |
| Responsive visual workbench | Ready | Uses the repository compute-stage asset, MiniApp OS v2 controls, bright surfaces, and high-contrast text. |
| Morpheus compute dispatch | Not implemented | Authenticated `/compute/execute` is not called. |
| On-chain request write | Not implemented | No wallet prompt, fee transfer, request ID, or transaction is created. |
| Compute result | Unavailable | Never synthesized from a local digest. |
| Proof / attestation | Unavailable | Never synthesized or marked verified. |
| Pending / retry / readback | Not applicable | There is no write and no job ID in this release. |

## Runtime contract

The checked-in Morpheus catalog defines:

- workflow: `compute.execute`
- route: `/compute/execute`
- policies: `tenant`, `risk`
- execution plane: `tee_runtime`
- TEE required: `true`
- delivery: `api_response`
- envelope version: `2026-04-tee-v1`

The UI calls this a **registry route snapshot**, not a live connection. Current live drift and degraded testnet evidence are recorded in [NETWORK_STATUS.md](./NETWORK_STATUS.md).

## Recovery contract for future dispatch

Dispatch must not be added as a fire-and-forget action. A production implementation needs this state machine:

1. authenticate and submit exactly once;
2. persist the returned job/request ID before showing `pending`;
3. read back by ID until a documented terminal state;
4. on timeout or reload, retry readback only;
5. expose result only after terminal success;
6. expose proof/attestation only after their actual verification succeeds;
7. never convert a transport failure into a zero/empty result.

No funded transaction, deployment, secret, signing operation, or runtime POST was used for this release.

## Final verification

- Focused config/integration/logic/surface/production suite: `31/31` tests passed.
  It covers exact mainnet/testnet route binding, source limits, canonical digests,
  disclosure behavior, missing SHA-256, invalid input recovery, out-of-order
  completion, unsafe-number rejection, exact digest preimage, copy accuracy,
  product hierarchy, and responsive/reduced-motion rules. The repository-wide
  message-key/parity companion suite passed `79/79`;
  TypeScript and scoped ESLint passed.
- The production build transformed 1,844 modules. The app entry
  is 191.47 kB (57.73 kB gzip), UI JavaScript is 33.95 kB (12.03 kB gzip), and
  CSS is 107.47 kB (19.60 kB gzip).
- HTTP smoke: all `17/17` emitted files returned HTTP 200; the active launcher,
  compute-stage asset, logo, and manifest are byte-identical between source and
  `dist/`.
- App structure/source-to-dist assertions passed `15/15`, and the repository
  MiniApp dApp verifier passed all 77 catalog entries with zero failures.
- The 1672x941 compute-stage resource and 512x512 app logo were inspected from
  the checked-in files. Browser/Playwright capture was intentionally not used in
  this scoped lane, so live rendered visual comparison remains a parent-level
  integration check.
- After independent review, the verified production dist was synchronized to
  the host and is byte-identical. The catalog remains 77 entries with unique
  app IDs and slugs.
