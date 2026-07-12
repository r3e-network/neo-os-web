# Network Status

Status date: 2026-07-11

This file separates checked-in product bindings from time-sensitive runtime observations. The final production pass used deterministic mocks and repository sources only; it did not contact live Morpheus or Neo RPC endpoints.

## Checked-in bindings

The app resolves network addresses through `apps/shared/constants/generated-morpheus-registry.ts` and signer roles through `apps/shared/constants/generated-morpheus-signer-registry.ts`, both exposed by `apps/shared/constants/rpc.ts`.

| Target | Morpheus public API | Neo RPC | MorpheusOracle | Callback consumer |
| --- | --- | --- | --- | --- |
| Mainnet | `https://oracle.meshmini.app/mainnet` | `https://api.n3index.dev/mainnet` | `0xf54d8584ef82315c1800373272ab08ae0db2d5ef` | `0xe1226268f2fe08bea67fb29e1c8fda0d7c8e9844` |
| Testnet | `https://oracle.meshmini.app/testnet` | `https://api.n3index.dev/testnet` | `0x4b882e94ed766807c4fd728768f972e13008ad52` | `0x8c506f224d82e67200f20d9d5361f767f0756e3b` |

| Target | Signed-response `worker` key | On-chain `oracle_verifier` key | Role relation |
| --- | --- | --- | --- |
| Mainnet | `038c80a6a7fb694a78cdbf7eb91477cb0f7b6d372a5ca840b554c803fbc89c8769` | `0252183e08434f69693f6496cb9473eb60e8cd790fadecb774c5485440435c7c98` | Separate keys |
| Testnet | `02911ea28aee939ef686f42e1137954135998b71e7e997794bde8c0a40f4b95cb4` | `02911ea28aee939ef686f42e1137954135998b71e7e997794bde8c0a40f4b95cb4` | Same key today |

The manifest defaults to Neo N3 Mainnet, supports both networks, requests only `read:blockchain`, declares no app contract, and disables platform transactions.

## Runtime evidence model

On load or manual refresh, the app attempts these read-only checks:

1. same-origin `/api/morpheus/vrf/status?network=<network>` for public health, runtime status, and verifier-key metadata;
2. `getcontractstate` for the selected Oracle and callback contracts;
3. safe `invokefunction` reads for request totals, fulfilled totals, request fee, Oracle verification key, and callback `oracle()` binding.

No check calls `/vrf/random`, requests a wallet, or submits a transaction.

The product classification is:

- `protected`: contract key and callback binding are exact, service evidence is coherent, and required reads are present;
- `network-mismatch`: reported network or runtime key conflicts with the selected registry target;
- `degraded`: only part of the service/chain evidence is available or a read is malformed;
- `unavailable`: neither service evidence nor a usable contract verifier key is available;
- `cached status`: previously validated service/contract evidence is available but stale. It cannot claim current service readiness; response signatures can still be checked against the independently pinned network `worker` key.

## Last recorded external observations

The current README records a read-only environment check from 2026-07-11:

- mainnet reported ready and its `oracle_verifier` matched the selected on-chain fulfillment key;
- testnet health reported mainnet identity while the testnet key endpoint and contract exposed testnet values, so the app classified it as a network mismatch;
- both callback consumers resolved to their expected network-specific Oracle contract;
- the public workflow catalog did not advertise a VRF workflow;
- protected randomness submission required an authenticated integration.

These observations were not repeated during this offline product pass and may have changed. They are not release-day uptime proof.

## Release-day checks still required

- refresh both service targets and both Neo RPC bindings;
- confirm contract names/checksums, verifier key, callback binding, counters, and fixed-8 fee;
- confirm the same-origin status route still returns partial failures without inventing readiness;
- obtain a response through an authorized consumer integration and verify it in the workbench;
- keep submission, wallet, deployment, and funded operations in their separately authorized release workflow.
