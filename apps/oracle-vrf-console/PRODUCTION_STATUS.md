# Production Status

Status date: 2026-07-11

## Product boundary

Oracle VRF Workbench is production-ready as a bright, read-only Morpheus request and response-verification tool.

| Capability | Status | Product behavior |
| --- | --- | --- |
| Request drafting | Ready | Produces the exact `request_id` + `target_chain=neo_n3` body and labels it `draft-not-submitted`. |
| Use-case selection | Ready | Game, raffle, and fair-allocation choices drive the primary experience; identifiers remain in the secondary drawer. |
| Network binding display | Ready | Mainnet/testnet service URL, Neo RPC, Oracle contract, callback contract, response signer, fulfillment verifier, counters, and fee are separated and labelled. |
| Signed-response verification | Ready | Recomputes the canonical randomness hash, checks the secp256r1 signature against the selected network's pinned Morpheus `worker` key, and reports unsigned request correlation separately. |
| Local recovery | Ready | Drafts, pasted responses, and service snapshots use exact storage readback. No-op storage becomes an explicit local-only state. |
| Concurrent actions | Ready | Draft replacement and clearing cannot race response verification; late startup refreshes cannot overwrite a user-created draft. |
| Stale response handling | Ready | Verification publishes only when the draft ID and pinned response-signer context still match the context captured at start; volatile service evidence may remain visibly stale. |
| Wallet connection | Not required | This release performs no wallet action or Neo transaction. |
| Protected VRF submission | External boundary | The workbench never calls `POST /vrf/random`; an authenticated consumer or contract integration performs submission. |
| Full Nitro certificate/PCR verification | Not implemented | Hash binding is shown, but complete attestation-chain validation is not claimed. |

## Product and visual hierarchy

- The primary surface is a real, warm Oracle workspace asset plus a three-step request → external submission → verification path.
- The single primary action builds a request draft. Service refresh and copy remain secondary actions.
- Advanced consumer/reference labels, service evidence, response JSON, and exact payload stay behind a four-mode drawer instead of forming a page-long input sheet.
- Stale, degraded, unavailable, and network-mismatch evidence uses warning treatment; it is never presented with the ready treatment.
- The launcher manifest uses `oracle-workspace-stage.webp` rather than the older testnet-labelled marketing banner.
- Lucide supplies interface icons. The rendered experience contains no emoji, inline SVG, CSS illustration, ASCII art, or placeholder artwork.

## Product-correctness and recovery rules

1. Request IDs require browser cryptographic randomness; the app does not fall back to an all-zero or predictable identifier.
2. Restored drafts must match the selected network, canonical endpoint, normalized local context, generated request-ID shape, and an exact ISO timestamp.
3. Neo counters and fees are accepted only as exact non-negative safe integers. Malformed reads become unavailable/degraded evidence, never believable zeroes.
4. Cached service snapshots are reconstructed from validated fields and are always marked stale.
5. A response timestamp must be an actual positive safe integer, not a coercible string.
6. A response cannot become verified when its draft network differs from the selected response-signer network.
7. Draft and response persistence require exact write/readback; clearing requires exact delete/readback. Failure keeps the current-session workflow usable but visibly non-durable.
8. Mainnet `worker` and `oracle_verifier` keys are deliberately treated as separate roles. A response is never checked against the fulfillment key merely because both roles currently coincide on testnet.

## Validation evidence

- Focused config, logic, integration, PlayArea, and production-state suite: `36/36` tests passed.
- Host companion service-route and PlayArea registry suite: `124/124` tests passed.
- App TypeScript and scoped ESLint passed.
- Production build: Vite transformed `3,574` modules.
- App JavaScript: `214.76 kB` (`64.92 kB` gzip).
- App CSS: `107.53 kB` (`19.30 kB` gzip).
- Static HTTP smoke: `17/17` emitted files returned HTTP 200.
- Source/dist manifest and launcher assets: `9/9` byte-identical after build.
- Manifest, product-boundary, asset, and documentation structure gate: `9/9` checks passed.
- The built MiniApp was copied to the host public directory byte-for-byte; the host catalog remains `77/77` unique app IDs and slugs with one Oracle VRF `1.1.0` entry.
- No deployment, wallet prompt, signature, transaction, funded operation, or live endpoint call was performed in this final validation pass.

## Remaining external verification

- Current Morpheus uptime, CORS behavior, runtime catalog contents, and contract counters remain time-sensitive and must be refreshed before a release-day operational claim.
- A real authenticated `/vrf/random` response was not requested in this workstream; response fixtures exercise the documented envelope and real secp256r1 verification code.
- Browser/device visual QA was intentionally not run in this workstream. The production build, component rendering tests, responsive structure assertions, and local source-asset inspection passed, but a later host-level device pass is still required.
- Existing image files predate this pass and do not include complete upstream creation/license records; see [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).
