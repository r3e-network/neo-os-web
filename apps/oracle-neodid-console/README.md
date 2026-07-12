# Oracle NeoDID Console

Oracle NeoDID Console is a read-only evidence inspector for Morpheus NeoDID. Its primary action resolves a supported DID, reads the provider catalog for the launched network, and checks the resolver-declared registry anchor against the canonical Neo network deployment.

It does **not** verify identity, attest a claim, verify a signature, dispatch an Oracle job, connect a wallet, or broadcast a transaction. A returned DID document, provider/claim catalog match, and declared Oracle gateway are metadata observations only.

## Product flow

1. Launch on Neo N3 mainnet or testnet.
2. Press **Resolve DID** to inspect the default NeoDID service identifier immediately.
3. Review the returned document, registry deployment, catalog context, and Oracle service declaration in the main evidence map.
4. Open **Inspect details** only when an exact service, Vault, or AA DID and provider context is needed.
5. Copy the complete JSON snapshot for downstream review.

The latest result expires after fifteen minutes, including while the app remains open. Copying performs a second expiry check, so a stale snapshot cannot be exported during the UI refresh interval. Only digest-checked evidence for the same launch network can be restored. An interrupted resolver GET can be resumed for five minutes; failures clear the prior snapshot before surfacing an error.

## Network truth

- Mainnet checks network magic `860833102`, the canonical NeoDID contract `0xb81f31ea81e279793b30411b82c2e82078b63105`, and manifest name `NeoDIDRegistry` with read-only RPC calls.
- Testnet first verifies network magic `894710606`, then reports that the canonical Morpheus registry has no NeoDID contract. A resolver-declared anchor on that network is reported as a mismatch.
- The same-origin provider endpoint can return a runtime catalog or an empty host fallback. A listed provider/claim is still not a completed attestation.
- DID services, verification methods, provider identifiers, aliases, and claim lists are decoded as bounded structures. Malformed or ambiguous payloads degrade to unavailable instead of being filtered into evidence.
- Local recovery is advertised only after storage write and delete readbacks succeed. Resolution and JSON copy remain usable when storage is unavailable.

## Local verification

```sh
npm exec tsc -- --noEmit -p tsconfig.json
npm run build
npm exec eslint -- src
```

Focused repository tests live in `apps/shared/test/oracle-neodid-console.*.test.*`; run them from `apps/shared` with `npx vitest run test/oracle-neodid-console.*.test.*`.
