# Confidential Transfer — TestNet status

Verified: 2026-07-11

## Product boundary

- The published MiniApp is a TestNet-only encrypted transfer-intent workspace.
- It does not connect a wallet, broadcast a transaction, move NEO/GAS, verify a
  TEE attestation, or execute settlement.
- The primary action creates and stores ciphertext only. A payment lane remains
  closed until a deposit/settlement contract, a verified TEE result, release and
  refund operations, and exact on-chain event/readback rules exist.
- MainNet creation is disabled in the manifest and at runtime.

## Read-only Oracle evidence

| Check | Result |
| --- | --- |
| Network | Neo N3 TestNet |
| Contract | `0x4b882e94ed766807c4fd728768f972e13008ad52` |
| Manifest name | `MorpheusOracle` |
| NEF checksum | `785941005` |
| `oracleEncryptionAlgorithm/0` | safe, String, `HALT` |
| `oracleEncryptionPublicKey/0` | safe, String, `HALT`, raw 32-byte X25519 key |
| Pinned algorithm | `X25519-HKDF-SHA256-AES-256-GCM` |

The public read endpoint returned the same network, contract, and algorithm,
and a 44-character base64 value decoding to a 32-byte public key. The raw key
is intentionally not recorded in this status file because it may rotate.

The client pins the contract identity from the generated Morpheus registry,
then independently reads both safe getters immediately before encryption. The
endpoint key, contract key, algorithm, network, and encryption-time key must
all agree. Any mismatch closes the action.

The confidential-store route was not write-probed because that would create
external state. Storage success requires an explicit user submit and a valid
`secret_ref`; failure retains the exact validated v2 ciphertext packet for a
runtime-reverified retry.

## Product and visual readiness

- One native privacy-airlock workspace is the product source of truth; the host
  embeds it and no longer maintains a second form or settlement simulation.
- Recipient and amount are the primary composer; memo, crypto details, pinned
  checksum, wallet boundary, and stored references remain secondary.
- Official shared NEO/GAS art is used. Logo, banner, and privacy-corridor stage
  are project-generated mint-glass envelope/shield assets with no third-party
  reuse.
- The layout includes high-contrast light surfaces, visible focus states,
  reduced-motion handling, pending recovery, two-step discard, and mobile
  reflow.

## Verification commands

```sh
cd apps/shared
npx vitest --config vitest.config.ts run \
  test/private-transfer.seal.test.ts \
  test/private-transfer.playarea.test.tsx \
  test/private-transfer.integration.test.tsx

cd ../private-transfer
npx vitest run production-safety.test.ts

cd ../..
npx tsc -p apps/private-transfer/tsconfig.json --noEmit
npx eslint apps/private-transfer/src apps/private-transfer/production-safety.test.ts \
  apps/shared/test/private-transfer.*
npm --prefix apps/private-transfer run build
```

Browser/IAB screenshot sign-off is still required when that surface is
available; this pass validates assets, code structure, responsive CSS gates,
runtime behavior, build output, and HTTP/MIME delivery without claiming visual
browser certification.
