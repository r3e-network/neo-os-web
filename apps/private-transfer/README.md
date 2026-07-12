# Confidential Transfer

Confidential Transfer is a **testnet-only encrypted-intent workspace**. It is
not a payment rail and must never present itself as one.

## What the MiniApp proves

- A full Neo N3 recipient and fixed-unit amount are validated before sealing.
- Recipient, amount, memo, and a fresh note secret are encrypted in the browser
  with X25519, HKDF-SHA256, and AES-256-GCM.
- A fresh testnet Morpheus Oracle key must be returned from a valid Neo N3
  contract source, use the release-pinned contract hash, and match independent
  reads of that contract's safe `oracleEncryptionPublicKey` and
  `oracleEncryptionAlgorithm` methods immediately before encryption. The exact
  verified key must also be the key used by the envelope encryptor. Stale,
  cross-network, unpinned-contract, invalid-key, algorithm-mismatch,
  endpoint/contract mismatch, or mid-flight key-change cases fail closed.
- A seal is complete only after confidential storage returns a non-empty
  `secret_ref`.
- If storage fails or times out after encryption, the exact ciphertext and its
  public envelope are saved locally for retry. Plaintext fields are never
  persisted in recovery state.

## What the MiniApp does not do

- It does not connect a wallet, request a signature, lock assets, or send NEO/GAS.
- It has no private-transfer escrow or settlement contract.
- It does not receive or verify a TEE attestation, decrypt result, settlement
  signature, release, refund, anonymity proof, or on-chain payment.
- Public envelope metadata includes network, asset, commitment, and nullifier.

## Product flow

The primary surface is a privacy airlock rather than a generic operation form:
the generated packet art and four-step route explain what is happening, while
asset, amount, and recipient stay in a compact composer. Memo, privacy
boundaries, key source, wallet boundary, and receipts live in the secondary
details drawer. Successful storage clears private draft fields; failed storage
keeps the exact ciphertext available for an explicit retry or two-step discard.

The current UI uses the shared official NEO/GAS art and a warm, high-contrast
generated privacy-stage image. The matching envelope-and-shield logo and
banner are project-generated assets rather than copied third-party art.
Status, validation, focus, reduced-motion, and mobile reflow states are all
represented in the native workspace.

## Current service evidence (2026-07-11)

Read-only verification found the testnet `MorpheusOracle` contract at
`0x4b882e94ed766807c4fd728768f972e13008ad52`, manifest name
`MorpheusOracle`, and NEF checksum `785941005`. Its ABI exposes safe,
zero-argument String getters `oracleEncryptionPublicKey` and
`oracleEncryptionAlgorithm`; both read calls returned `HALT`, and the algorithm
was `X25519-HKDF-SHA256-AES-256-GCM`.

The confidential store was not write-probed during verification because that
would create external state. The UI therefore treats storage as unknown until
an explicit user submit, retains the exact validated ciphertext envelope after
a timeout or failure, re-verifies the testnet runtime before retry, and never
claims completion without a bounded, non-empty `secret_ref`.

## Verification

```sh
cd apps/shared
npx vitest run test/private-transfer.seal.test.ts test/private-transfer.playarea.test.tsx test/private-transfer.integration.test.tsx

cd ../private-transfer
npx vitest run production-safety.test.ts

cd ../..
npx tsc -p apps/private-transfer/tsconfig.json --noEmit
npx eslint apps/private-transfer/src apps/private-transfer/production-safety.test.ts apps/shared/test/private-transfer.*
npm --prefix apps/private-transfer run build
```
