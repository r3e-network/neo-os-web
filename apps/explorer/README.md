# Neo Explorer

Neo Explorer is a read-only Neo N3 chain workspace for Mainnet and Testnet. It searches real block heights, transaction or block hashes, Neo addresses, and contract hashes, then presents the returned chain object with its network and data-source context.

## Product boundary

- No wallet connection, signature, payment, or miniapp contract is required.
- Mainnet and Testnet are separate query lanes. Changing networks clears the previous result and reloads that network's recent transactions.
- A result is never invented from the query. The UI distinguishes a found record, a valid identifier with no record on the selected network, an invalid identifier, and an unavailable explorer service.
- Search, network telemetry, recent transactions, cached snapshots, and raw API records are separate states and surfaces.

## Supported identifiers

| Identifier | Accepted form | Resolution path |
| --- | --- | --- |
| Block height | 1–10 decimal digits | Neo N3 RPC `getblock` |
| Transaction or block hash | `0x` plus 64 hexadecimal characters | Indexer transaction lookup, then RPC transaction/block fallback |
| Neo address | Valid 34-character Neo N3 address | Indexed address activity |
| Contract hash | `0x` plus 40 hexadecimal characters | Indexed calls, with RPC `getcontractstate` fallback |

Client validation mirrors the production explorer API before a request is made. Hashes are not shortened in the record detail; compact forms are used only in the recent-transaction rail.

## Data-source semantics

- Block heights come from Neo N3 RPC through the platform explorer API.
- Transaction totals come from indexer sync state and render unavailable when the indexer does not supply a valid count.
- Transaction details, address activity, traces, and contract calls use the indexer when configured. Transaction and contract lookups fall back to Neo RPC where the API supports it.
- Recent transactions prefer the indexer and fall back to scanning recent RPC blocks.
- Network statistics refresh every 15 seconds. Recent transactions refresh every 30 seconds while the miniapp is visible.
- Cached data is labeled as a cached snapshot. Cached values are not relabeled as live when a fresh request fails.

## Interface hierarchy

1. One compact search command bar with network selection. The embedded workspace owns this flow end to end; the release manifest intentionally does not add a second host-generated parameter form.
2. A primary result surface that renders the actual transaction, block, address, or contract fields.
3. A secondary telemetry rail for the selected network and recent transactions.
4. A drawer for the complete recent list, raw API record, and data-source explanations.

The idle state uses the repository's existing WebP explorer artwork. Found records replace the illustration rather than appearing as another decorative card. Asset integrity and provenance are documented in [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).

## Recovery behavior

- Invalid input stays local and explains the accepted Neo N3 formats.
- A valid identifier with no record keeps the query visible and reports the selected-network miss.
- API, RPC, or indexer failures remain retryable and never become an empty success state.
- Switching networks or starting a newer search invalidates late responses from an older request.
- A network switch that occurs during a recent-transaction fetch queues the newly selected network instead of waiting for the next polling interval.

## Development and verification

```bash
npm --prefix apps/explorer run dev -- --port 5362
npm --prefix apps/explorer run build
npx tsc --noEmit -p apps/explorer/tsconfig.json
npx eslint apps/explorer/src --ext .ts,.tsx
cd apps/shared && npx vitest run test/explorer.logic.test.ts test/explorer.playarea.test.tsx test/explorer.integration.test.tsx test/explorer.test.tsx test/explorer.production.test.ts
```

Read-only network evidence and remaining limits are recorded in [NETWORK_STATUS.md](./NETWORK_STATUS.md) and [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md).
