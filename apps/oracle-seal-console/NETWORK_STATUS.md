# Oracle Seal Console network status

Read-only verification date: 2026-07-11.

No confidential-store write, wallet connection, signature, contract transaction, deployment, secret-bearing request, or ciphertext readback was performed.

## Neo N3 contract evidence

The app now reads the canonical N3Index RPC directly, so verifying the Oracle contract does not depend on an installed wallet provider. Read-only batch calls to `getcontractstate`, `oracleEncryptionPublicKey`, and `oracleEncryptionAlgorithm` returned:

| Network | RPC | MorpheusOracle | Public key | Algorithm |
| --- | --- | --- | --- | --- |
| MainNet | `https://api.n3index.dev/mainnet` | `0xf54d8584ef82315c1800373272ab08ae0db2d5ef` | `hurFDhEN1S6HsBNqmET8iJfpSYp9FUrDvyrZgoyVvWs=` | `X25519-HKDF-SHA256-AES-256-GCM` |
| TestNet | `https://api.n3index.dev/testnet` | `0x4b882e94ed766807c4fd728768f972e13008ad52` | `kQvtpPekS1fzHFhaU2XFyKVobY0pii/KrVZSEOD/xx4=` | `X25519-HKDF-SHA256-AES-256-GCM` |

Both invocation batches returned `HALT`, and both contract manifests identified `MorpheusOracle`. Both RPC responses exposed `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`, matching the MiniApp's opaque-origin read requirement.

## Public-key service evidence

| Probe | Result |
| --- | --- |
| `GET https://neomini.app/api/morpheus/oracle/public-key?network=mainnet` | HTTP 200; network, contract, key, and algorithm matched the MainNet contract read. |
| `GET https://neomini.app/api/morpheus/oracle/public-key?network=testnet` | HTTP 200; network, contract, key, and algorithm matched the TestNet contract read. |
| `GET https://oracle.meshmini.app/mainnet/oracle/public-key` | HTTP 200; `available: true`, `degraded: false`; source contract and key matched MainNet. |
| `GET https://oracle.meshmini.app/testnet/oracle/public-key` | HTTP 200; `available: true`, `degraded: false`; source contract and key matched TestNet. |

The deployed `neomini.app` responses still lacked `Access-Control-Allow-Origin` and returned `Cache-Control: public, max-age=0, must-revalidate`. The checked-in host route sets `Access-Control-Allow-Origin: *` and `Cache-Control: no-store, private`, so the deployed route is behind source and remains a release gate for opaque-origin MiniApp execution.

## Confidential-store service boundary

The checked-in host route now answers opaque-frame preflight, exposes a
non-mutating per-network capability response, and forwards ciphertext only
when server-side `MORPHEUS_*_CONFIDENTIAL_STORE_TOKEN` and
`MORPHEUS_*_CONFIDENTIAL_STORE_PROJECT_SLUG` values are configured. The
credential is added only on the server-to-server request, the project slug
cannot be supplied by the MiniApp, and the public envelope is bound into
upstream metadata.

The route does not expose a ciphertext readback contract. The frontend
therefore treats `secret_ref` only as a service routing receipt and explicitly
does not call it ownership, retrieval proof, a transaction, confidential
execution, or attestation.

The framework rejects upstream errors, empty/zero references, and `inline_fallback`. The frontend persists and verifies the exact ciphertext before the first POST, recomputes its fingerprint before retry, and marks an already-returned receipt in the recovery journal before cleanup so an interrupted local write does not become an ordinary second-store action.

The live confidential-store POST was not exercised because it creates external
state. The deployed host must receive the new route code and server-only
configuration, then pass one authorized, non-sensitive store-response and
cleanup lifecycle before external production enablement.

## Release interpretation

MainNet and TestNet contract/public-key evidence is current and internally
consistent. The app's local product path, host transport contract, and error
recovery are source-complete, but production service enablement remains
conditional on deploying the current public-key and store routes with the
server-only store configuration, then validating one non-sensitive receipt
lifecycle. No local preview, zero reference, fake transaction, assumed
readback, or assumed attestation substitutes for that missing external
evidence.
