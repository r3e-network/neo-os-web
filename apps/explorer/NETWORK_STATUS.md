# Neo Explorer Network Status

Read-only verification is scoped to the data sources declared by the production miniapp. No private key, wallet signature, transaction broadcast, or deployment is required.

## Expected source contract

| Surface | Mainnet | Testnet | Expected source |
| --- | --- | --- | --- |
| Block height | Supported | Supported | Neo N3 RPC through `/api/explorer/stats` |
| Transaction total | Supported when indexed | Supported when indexed | Indexer sync state |
| Recent transactions | Supported | Supported | Indexer, with recent-block RPC fallback |
| Block lookup | Supported | Supported | Neo N3 RPC |
| Transaction lookup | Supported | Supported | Indexer, with Neo N3 RPC fallback |
| Address activity | Supported when indexed | Supported when indexed | Indexer |
| Contract lookup | Supported | Supported | Indexer calls, with `getcontractstate` fallback |

## Live read-only evidence — 2026-07-12

- `https://neomini.app/api/explorer/stats` returned HTTP 200 with Mainnet height `11,433,648` and Testnet height `17,607,096`. Both transaction totals explicitly returned `null` with `txCountSource: "unavailable"`; the UI therefore shows the heights as RPC data and does not invent transaction totals.
- A later direct `getblockcount` read returned latest heights `11,433,662` on `https://mainnet2.neo.coz.io:443` and `17,607,110` on `https://testnet1.neo.coz.io:443`. The small difference is expected between independently timed live reads and the API's 15-second cache.
- Mainnet block `11,433,648` and Testnet block `17,607,096` both resolved through `/api/explorer/search` with `type: "block"`, `found: true`, the requested network, exact block hash, height, and transaction count.
- Mainnet GAS contract `0xd2a4cff31913016155e38e474a2c06d08be276cf` resolved as `GasToken` through RPC fallback. Testnet NEO contract `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5` resolved as `NeoToken` through RPC fallback.
- The address lookup for `NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw` returned `source: "indexer_unavailable"`. The production UI treats this as an unavailable source, not as proof that the address has no activity.
- Both Mainnet and Testnet recent-transaction routes returned HTTP 200 with `source: "unavailable"` and no rows. The UI exposes a retryable recent-data state while leaving RPC-resolvable searches usable.
- Invalid query `0xabc` returned HTTP 400 with `BAD_REQUEST`. The miniapp mirrors this format check locally and renders the invalid state without making the request.

No funded or state-changing operation is part of this product. A live transaction-detail lookup was not claimed because the live recent route supplied no transaction hash during this pass.
