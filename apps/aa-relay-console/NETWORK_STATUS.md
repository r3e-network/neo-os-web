# AA Relay Console Network Status

Read-only verification date: 2026-07-11

## Canonical AA anchors

| Network | AA Core | Domain | Live contract state |
| --- | --- | --- | --- |
| Neo N3 MainNet | `0x0268a387913b250166ddec032b03332690a1ef78` | `core.smartwallet.neo` | `UnifiedSmartWalletV3`, contract id `572`, update counter `4` |
| Neo N3 TestNet | `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` | not published | `UnifiedSmartWalletV3`, contract id `6523`, update counter `4` |

Both live manifests expose the methods this product depends on:

- `executeUserOp(accountId: Hash160, op: Any)` — state-changing
- `previewUserOpValidation(accountId: Hash160, op: Any)` — safe/read-only
- `getNonce(accountId: Hash160, channel: Integer)` — safe/read-only

The canonical on-chain AA paymaster is currently published on MainNet as `0xa0defa2bc6d7a71ba1e237149287c8ca4ff46caf` (`paymaster.smartwallet.neo`). The shared TestNet registry does not currently publish an AA paymaster, so the console rejects `executeSponsoredUserOp` review packages on TestNet rather than guessing an address.

## API observations

- `OPTIONS https://neomini.app/api/aa/relay` returned `204` and advertised `POST,OPTIONS` with opaque-origin CORS support. This proves route presence only; it does not prove upstream relay configuration, signer availability, paymaster approval, authentication, or broadcast readiness.
- The host relay route has no GET/status operation and forwards only request content type to its configured upstream. The MiniApp therefore has no trustworthy request-ID readback loop.
- A read-only production probe to `GET /api/rpc/gas-sponsor-check` returned `FORBIDDEN: function not allowed` on 2026-07-11. The UI treats this as unavailable rather than as zero quota or ineligibility evidence.
- No relay POST, sponsorship request, wallet signature, deployment, or funded transaction was performed in this verification lane.

## Source-of-truth hierarchy

1. Current live Neo RPC contract state and application logs.
2. Generated Morpheus/AA registry in `apps/shared/constants/generated-morpheus-registry.ts`.
3. Canonical `neo-abstract-account` V3 manifest and relay route implementation.
4. Historical relay reports only as past evidence; they are not treated as proof that the current deployed relay is live.

## Network isolation

Review packages, saved jobs, receipts, and RPC reads are all network-scoped. Receipt import requires an explicit network matching the package, and a saved job is restored only under its network-specific storage key and canonical AA Core.
