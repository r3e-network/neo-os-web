# Memorial Shrine network status

Read-only snapshot: 2026-07-12 (Asia/Shanghai)

This snapshot used public N3Index Neo N3 JSON-RPC endpoints. It made only
read-only calls such as `getversion`, `getblockcount`, `getcontractstate`, and
`invokefunction`. No wallet was opened; no invocation was signed, broadcast, or
deployed.

## Deployment summary

| Network | RPC | Magic | Block count observed | Contract | Update | NEF checksum |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| MainNet | `https://api.n3index.dev/mainnet` | 860833102 | 11,435,252 | `0xee7a548b71c69364fcb0e45a63a40f141b938e42` | 1 | 3168880566 |
| TestNet | `https://api.n3index.dev/testnet` | 894710606 | 17,608,714 | `0x87f0fe2ba69cd973a3274471234d3cc13ef943c5` | 0 | 755468124 |

Block counts are observation points, not pinned release heights.

## Read status

| Getter | MainNet | TestNet |
| --- | --- | --- |
| `getMemorialCount` | `HALT`, `0` | `HALT`, `36` |
| `getObituaryCount` | `HALT`, `0` | `HALT`, `36` |
| `isPaused` | `HALT`, `false` | `HALT`, `false` |
| `paymentHub` | `HALT`, null/unconfigured | `HALT`, zero hash; not used by the deployed TestNet payment lane |

An unavailable or malformed getter response remains unavailable in the UI. It
is not normalized to a synthetic zero.

## ABI alignment

Both contracts are named `MiniAppMemorialShrine` and expose:

- `createMemorial` with 8 parameters;
- `MemorialCreated` with 4 event parameters;
- `TributePaid` with 3 event parameters;
- the memorial, obituary, tribute, offering menu, pause, and count getters used
  by the frontend.

The tribute write lanes differ:

| Network | Deployed lane | Frontend behavior |
| --- | --- | --- |
| MainNet | `payTribute` has 5 parameters, including `receiptId`; no `onNEP17Payment` | Requires a configured `paymentHub`. Because the live getter is unconfigured, tribute is blocked before wallet interaction. |
| TestNet | `payTribute` has 4 parameters; `onNEP17Payment` and `offerIncense` are present | Uses the framework payment-plus-invocation path and the 4-parameter tribute ABI. |

The six observed `getOfferingCost` values, in Fixed8 units, are `1,000,000`,
`2,000,000`, `3,000,000`, `5,000,000`, `10,000,000`, and `50,000,000`.

The repository does not contain the deployed Memorial Shrine contract source,
so deployed ABI/state is the runtime source of truth for this frontend. A
future contract change must be rechecked read-only before enabling writes.
