# NeoDID Passport

NeoDID Passport is a document inspector and local review-envelope tool. It resolves a Morpheus NeoDID through the host platform, shows the returned document and network evidence, and can ask a connected Neo N3 wallet to sign canonical review text that is embedded verbatim as `proof.signedMessage` in the export.

It does **not** issue a credential, prove DID ownership, validate user-entered claims, verify the returned wallet signature, register a DID, or broadcast a transaction. The exported digest can be recomputed independently. The bundle also records the exact text requested for signing, but the host does not expose each wallet adapter's preimage convention, so the signature cannot be cryptographically verified from this bundle alone. Treat it as an opaque wallet-returned artifact unless the wallet/provider supplies compatible verification metadata.

## Product flow

1. Choose a short review context or open **Review details** for exact relying-party values.
2. Resolve the DID and create a ten-minute local review envelope.
3. Inspect the document, runtime metadata, and registry boundary.
4. Optionally attach a wallet signature. The app checks wallet address/network continuity and any wallet-reported signing account (address or script-hash form), but labels the proof as unverified.
5. Copy the complete JSON, including the DID-resolution snapshot, registry observation, exact requested signing text, and explicit verification limitation.

The latest valid envelope is stored locally only after an exact readback succeeds. If storage is unavailable or silently ignores a write, the in-memory JSON remains copyable and **Retry local recovery** can persist that exact envelope later without resolving or signing again. An interrupted resolver read can resume for up to five minutes, keeps its checkpoint until the replacement recovery checkpoint is written, and every resolver request has a ten-second deadline. A wallet prompt is never replayed automatically; the recovered envelope remains available and the user decides whether to retry. Malformed signature encodings are rejected rather than padded into an artifact.

## Network truth

- Mainnet: the repository registry snapshot declares NeoDIDRegistry at `0xb81f31ea81e279793b30411b82c2e82078b63105`. At runtime the app confirms network magic, exact contract hash, and manifest name with read-only RPC calls.
- Testnet: the repository registry snapshot has no NeoDID registry deployment. The app reports that limitation instead of treating resolver output as an on-chain identity proof.
- The host resolver can return a syntactically valid document without checking a subject binding. “Document returned” therefore never means “identity verified.”

## Local verification

```sh
npm exec tsc -- --noEmit -p tsconfig.json
npm run build
```

Repository-level tests live in `apps/shared/test/neodid-passport.*.test.*`.
