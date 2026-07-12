# NeoDID Passport production status

Version: `1.2.0`

## Product result

- A bright identity desk and a passport object lead the workflow. Review-purpose
  choices are compact application controls; exact DID, claim, audience, raw
  evidence, copy, reset, and recovery tools stay in the secondary drawer.
- The primary action resolves the selected DID and creates a ten-minute local
  review envelope. Wallet signing remains optional and secondary.
- The exported envelope contains the resolver snapshot, registry observation,
  nonce, digest, exact wallet-signing text, and the wallet adapter limitation.
- Resolver output, registry deployment evidence, user-authored labels, and a
  wallet-returned signature remain separate. None is relabelled as credential
  issuance, DID ownership, claim verification, or a verified signature.

## Correctness and recovery

- Resolver documents must match the requested DID. Controller, service, and
  verification-method arrays are bounded and structurally checked instead of
  being coerced into evidence.
- Duplicate signing requests collapse to one wallet prompt. The app checks the
  selected network and wallet address before and after signing, and abandons a
  request if its review is discarded while wallet connection is in progress.
- When the wallet adapter reports the actual signing account, its address or
  script-hash form must match the connected Neo address. Impossible base64
  signature lengths are rejected instead of being padded into a record.
- The same-origin DID resolver has a ten-second request deadline as well as
  draft-change cancellation, so a stalled resolver cannot leave the product
  indefinitely busy.
- Local envelope writes and checkpoint deletions are read back before recovery
  is reported as available. A silent/no-op storage adapter is treated as a
  failure, while the exact in-memory JSON remains copyable.
- When storage becomes available again, **Retry local recovery** persists and
  reads back the current envelope without recreating or resigning it.
- Interrupted resolver reads can resume once from a recent checkpoint. Wallet
  prompts are never replayed automatically.
- A resolver checkpoint remains durable until the resumed resolver has written
  its replacement checkpoint; recovery no longer creates a gap while the saved
  payload is being restored and checked.

## Verification evidence (2026-07-12)

- Focused logic, integration, and product-surface suites: 43/43 tests passed.
- Bilingual key parity: 79/79 tests passed.
- NeoDID frontend structure gate: 1/1 passed.
- Scoped TypeScript and ESLint checks passed.
- Production build: 1,842 modules transformed in 9.24 seconds; app entry
  215.95 kB (64.82 kB gzip), CSS 102.45 kB (18.88 kB gzip), with React, UI,
  platform SDK, and crypto emitted as separate chunks.
- Build warnings are limited to upstream Semi theme Sass `@import`
  deprecations.
- Static HTTP smoke: all 16 emitted files returned HTTP 200.
- `passport-desk.webp`, `logo.webp`, and the legacy `banner.webp` were inspected
  locally. The manifest and social preview now select the real identity desk,
  avoiding a TESTNET-labelled launcher for a mainnet-capable product.
- The production `dist/` was copied to the host miniapp directory and verified
  byte-identical. The regenerated catalog contains 77 entries with 77 unique
  app IDs and exactly one NeoDID Passport `1.2.0` row using
  `passport-desk.webp` as its launcher artwork.
- Git index remained empty. No deployment, wallet signature, transaction,
  funded account, or live-network request was performed in this lane.

## External product boundaries

- DID resolution depends on the host's same-origin NeoDID resolver.
- At runtime, a mainnet registry observation depends on the configured Neo RPC.
  The current repository registry snapshot has no NeoDID testnet deployment.
- The host does not expose each wallet adapter's signing-preimage convention,
  so the exported signature remains an opaque wallet-returned artifact.
