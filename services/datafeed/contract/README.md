# NeoFeeds On‑Chain Contract

NeoFeeds (`service_id`: `neofeeds`) can optionally anchor aggregated price updates on-chain using the **platform** `PriceFeed` contract.

## Canonical Source

- Contract implementation: `../../../contracts/PriceFeed/PriceFeed.cs`
- Platform contract overview: `../../../contracts/README.md`

## Purpose

`PriceFeed` stores the latest price round for a symbol:

- Writes are restricted to the contract **Updater** (set by admin).
- Each update stores an `attestation_hash` for auditability.
- `round_id` is enforced as **monotonic** to prevent replay.

## Key Methods / Events

- `SetUpdater(updater)`: admin sets the Updater account.
- `Update(symbol, roundId, price, timestamp, attestationHash, sourceSetId)`: Updater publishes a new round.
- `GetLatest(symbol)`: reads the most recent round for a symbol.
- Event: `PriceUpdated`.

## Configuration

The service discovers the deployed contract via:

- `CONTRACT_PRICE_FEED_ADDRESS`: deployed contract address (see `../../../.env.example`).

On-chain writes are performed via `../../txproxy/README.md` (allowlisted sign+broadcast).
