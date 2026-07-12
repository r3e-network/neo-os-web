# Oracle VRF Workbench

Oracle VRF Workbench is a read-only request and verification tool for the Morpheus signed-randomness lane. It deliberately separates three states that must not be conflated:

1. a local request draft;
2. submission through an authenticated consumer or contract integration;
3. verification of the returned signed response.

The MiniApp does not connect a wallet, broadcast a Neo N3 transaction, or `POST` to the protected randomness endpoint. A locally generated request ID is always labelled `draft-not-submitted`.

## Canonical service request

The runtime handler accepts `POST /vrf/random` with this body:

```json
{
  "request_id": "vrf:mainnet:consumer:<nonce>",
  "target_chain": "neo_n3"
}
```

Consumer labels, job references, repeat counts, and proof-mode selectors are not part of this service interface. The workbench keeps its consumer/use-case labels as local context and copies only the exact request body above.

| Network | Service base | MorpheusOracle | Callback consumer |
| --- | --- | --- | --- |
| Mainnet | `https://oracle.meshmini.app/mainnet` | `0xf54d8584ef82315c1800373272ab08ae0db2d5ef` | `0xe1226268f2fe08bea67fb29e1c8fda0d7c8e9844` |
| Testnet | `https://oracle.meshmini.app/testnet` | `0x4b882e94ed766807c4fd728768f972e13008ad52` | `0x8c506f224d82e67200f20d9d5361f767f0756e3b` |

These addresses and endpoints come from the generated Morpheus registry in `apps/shared/constants/generated-morpheus-registry.ts`. Response-signing and fulfillment-verification roles come from `apps/shared/constants/generated-morpheus-signer-registry.ts`, which is synchronized from the canonical Morpheus `signer-identities.json`.

## Read-only boundary checks

On load and manual refresh the workbench reads:

- the public, read-only `/api/morpheus/vrf/status` host route, which aggregates `/health`, `/v1/status`, and `/oracle/public-key` from the selected Morpheus service without forwarding credentials or exposing a dispatch route;
- deployed Oracle and callback contract state through the selected N3Index RPC;
- `getTotalRequests`, `getTotalFulfilled`, `requestFee`, `oracleVerificationPublicKey`, and the callback consumer's `oracle` binding.

The upstream service does not currently return browser CORS headers for those status reads. The same-origin host route therefore returns `Access-Control-Allow-Origin: *` for the opaque-origin MiniApp iframe. It accepts only `GET`, is rate-limited, uses no-store responses, and never proxies `/vrf/random`. The app never probes `/vrf/random` itself; submission remains an external authenticated integration step.

The last recorded read-only environment check (2026-07-11) found the following. It was not repeated during the offline product-polish pass, so treat it as time-sensitive evidence rather than current uptime proof:

- mainnet health reported ready on mainnet and its `oracle_verifier` matched the on-chain fulfillment key;
- testnet health reported `network: mainnet` and the mainnet `oracle_verifier`, while `/testnet/oracle/public-key` and the testnet contract exposed the testnet fulfillment key, so the UI correctly classifies testnet as a network mismatch;
- the public runtime workflow catalog did not advertise a VRF workflow;
- anonymous access to `/vrf/random` required Turnstile, and `/attestation` returned `runtime_route_unavailable` during runtime restoration;
- both Oracle contracts and both callback consumers were deployed and their callback `oracle()` values pointed at the expected network-specific Oracle;
- request/fulfilled counters were `7/6` on mainnet and `6120/6119` on testnet at audit time; these counters are live and will change.

## Verification scope

The Morpheus handler returns `vrf_method: "csprng-signed"`. This is a signed CSPRNG result, not a mathematical EC-VRF proof.

The client verifier:

- requires the canonical envelope and duplicate `verification` fields to agree;
- requires a 32-byte hexadecimal `randomness` value;
- recomputes `SHA-256(stableStringify({ randomness }))`;
- pins the response public key to the selected network's checked-in Morpheus `worker` key;
- verifies the Neo secp256r1 `r || s` signature;
- separately checks that `request_id` matches the active local draft.

The Morpheus runtime signs this response envelope with the `worker` role. Neo N3 contract fulfillment uses the distinct `oracle_verifier` role. Those keys are currently different on mainnet and happen to be identical on testnet, so the workbench displays and evaluates them separately instead of relying on the testnet coincidence.

The signature covers only the canonical `{ randomness }` object. `request_id` and `timestamp` are correlation metadata and are not cryptographically signed. The workbench also checks the attestation-hash binding, but it does not independently validate the complete AWS Nitro certificate/PCR chain and never claims that it does.

## Recovery

The active request draft, last pasted response (capped at 64 KB), and last successful service snapshot use `app.storage.local`. Persistence is claimed only after exact write/readback and delete/readback checks. If storage is unavailable or behaves as a no-op, the request remains usable in the current session and is visibly labelled local-only.

A reload restores only structurally valid, same-network drafts and service evidence. The live service/contract panel remains visibly stale until refreshed. A saved response may still verify against the selected network's checked-in `worker` signer because that response trust anchor is independent of volatile service counters and the separate on-chain fulfillment key. Clearing a draft also reports when stored deletion could not be confirmed, so a record that may reappear after reload is never described as durably removed.

See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md), [NETWORK_STATUS.md](./NETWORK_STATUS.md), and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for the current product boundary, environment evidence, and asset history.

## Validation

Run the scoped checks from the repository root:

```sh
npx vitest run apps/shared/test/oracle-vrf-console.config.test.ts apps/shared/test/oracle-vrf-console.logic.test.ts apps/shared/test/oracle-vrf-console.integration.test.tsx apps/shared/test/oracle-vrf-console.playarea.test.tsx apps/shared/test/oracle-vrf-console.production.test.ts --config apps/shared/vitest.config.ts
npx tsc -p apps/oracle-vrf-console/tsconfig.json --noEmit
npx eslint apps/oracle-vrf-console/src apps/shared/test/oracle-vrf-console*.test.ts apps/shared/test/oracle-vrf-console*.test.tsx
npm --prefix apps/oracle-vrf-console run build
npm --prefix platform/host-app test -- --runInBand __tests__/api/morpheus.vrf.status.test.ts __tests__/components/PlayAreaRegistry.test.tsx
```
