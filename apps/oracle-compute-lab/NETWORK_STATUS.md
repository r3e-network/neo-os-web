# Network Status

Read-only verification snapshot: 2026-07-11 15:12–15:13 UTC. The 2026-07-11
product pass did not repeat these network probes, and the MiniApp labels the
values as a checked-in registry snapshot rather than live status. No
authenticated request, POST dispatch, wallet signing, funded transaction,
contract update, or deployment was performed.

## Runtime observations

| Target | Probe | Observation | Product classification |
| --- | --- | --- | --- |
| Mainnet | `GET https://oracle.meshmini.app/mainnet/health` | HTTP 200; `ready: true`, `network: mainnet`, `checks.compute: true`. | Public health responds, but this is not evidence that this app can dispatch. |
| Mainnet | `GET .../mainnet/v1/status` | HTTP 200; runtime `operational`; catalog includes `compute.execute`; envelope `2026-04-tee-v1`. | Read-only runtime metadata available. |
| Mainnet | unauthenticated `GET .../mainnet/compute/execute` | HTTP 401 `unauthorized`. | Dispatch needs an authenticated backend integration; the MiniApp keeps the submit step unavailable. |
| Testnet | `GET .../testnet/health` | HTTP 200, but response body reports `network: mainnet` and the mainnet verifier key. | **Network mismatch / degraded target.** Do not present testnet as verified-ready. |
| Testnet | `GET .../testnet/v1/status` | HTTP 200 and runtime `operational`, while the paired health response identifies mainnet. | Status alone is insufficient; target remains mismatched. |

## Contract observations

Read-only Neo JSON-RPC calls used `getcontractstate` and safe `invokefunction` methods.

### Mainnet checked-in registry contract

- RPC: `https://api.n3index.dev/mainnet`
- hash: `0xf54d8584ef82315c1800373272ab08ae0db2d5ef`
- manifest: `MorpheusOracle`, update counter `1`
- production-kernel ABI includes `getSystemModule`, `submitMiniAppRequest`, `getRequest`, and `getInboxItem`
- active system module `compute.run` resolves to `/compute/execute` with schema `morpheus.module.compute.run.v1`
- `requestFee`: `1,000,000` fixed-8 GAS units (`0.01 GAS`)
- `getTotalRequests`: `7`; `getTotalFulfilled`: `6` at probe time
- runtime encryption algorithm: `X25519-HKDF-SHA256-AES-256-GCM`; key version `2`

### Testnet checked-in registry contract

- RPC: `https://api.n3index.dev/testnet`
- hash: `0x4b882e94ed766807c4fd728768f972e13008ad52`
- manifest: `MorpheusOracle`, update counter `8`
- older Oracle-only ABI: no system-module registry, `submitMiniAppRequest`, or inbox reads
- `requestFee`: `1,000,000` fixed-8 GAS units (`0.01 GAS`)
- `getTotalRequests`: `6120`; `getTotalFulfilled`: `6119` at probe time

## Deployment registry mismatch requiring operator follow-up

The live mainnet `/api/runtime/catalog` returned a different `morpheusOracle` hash, `0x5b492098fc094c760402e01f7e0b631b939d2bea`, while:

- this repository's generated public registry points to `0xf54d...d5ef`;
- the live `/mainnet/oracle/public-key` response also names `0xf54d...d5ef` as its Neo N3 key source;
- both `0xf54d...d5ef` and `0x5b49...2bea` exist on mainnet with production-kernel ABIs.

Until the canonical Oracle registry is reconciled and regenerated, the MiniApp displays the checked-in value only as a **registry snapshot** and does not embed any contract hash into a dispatch-ready request.

## Product consequence

The local package builder is usable on either selected registry target because it performs no network call. Runtime dispatch remains intentionally unavailable. Testnet cannot be called production-ready from the observed health response, and mainnet contract identity drift prevents a stronger live contract claim.
