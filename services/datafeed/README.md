# NeoFeeds Service

Price oracle service for the Neo Service Layer.

## Overview

The NeoFeeds service provides aggregated price feeds from multiple sources with TEE attestation. It fetches prices from multiple **HTTP sources** (Binance, Coinbase, OKX by default), aggregates them using a (weighted) median, and signs responses with the TEE-held signing key. When configured, it also anchors updates to the platform `PriceFeed` contract on Neo N3 via `txproxy` (allowlisted sign+broadcast) using the `≥0.1%` publish policy.

Optional: if `ARBITRUM_RPC` is configured, Chainlink (Arbitrum) is enabled as an additional data source (it does not replace HTTP sources).

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Price Sources│     │ NeoFeeds Svc │     │ PriceFeed    │
│ (HTTP APIs,  │     │ (TEE)        │     │ (Neo N3)     │
│  optional CL)│     │              │     │ Contract     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Fetch Prices       │                    │
       │<───────────────────│                    │
       │                    │                    │
       │ Price Data         │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ Aggregate & Sign   │
       │                    │                    │
       │                    │ update()           │
       │                    │───────────────────>│
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/info` | GET | Service configuration |
| `/price/{pair}` | GET | Get single price |
| `/prices` | GET | Get all prices |
| `/feeds` | GET | List available feeds |
| `/sources` | GET | List data sources |
| `/config` | GET | Get full configuration |

## Default Feeds (Configurable)

The feed list is configured via YAML/JSON; the default config includes common USD feeds such as:

| Feed ID | Base | Quote | Decimals |
|---------|------|-------|----------|
| BTC-USD | BTC | USD | 8 |
| ETH-USD | ETH | USD | 8 |
| NEO-USD | NEO | USD | 8 |
| GAS-USD | GAS | USD | 8 |

## Data Sources

| Source | Type | Default | Weight |
|--------|------|---------|--------|
| Binance | HTTP API | Yes | 1 |
| Coinbase | HTTP API | Yes | 1 |
| OKX | HTTP API | Yes | 1 |
| Chainlink (Arbitrum) | On-chain | Optional | 1 |

## Request/Response Types

### Get Price

```json
GET /price/BTC-USD

{
    "feed_id": "BTC-USD",
    "pair": "BTC-USD",
    "price": 10500000000000,
    "decimals": 8,
    "timestamp": "2025-12-07T09:00:00Z",
    "signature": "<base64>",
    "public_key": "<base64>",
    "sources": ["binance", "coinbase", "okx"]
}
```

### Get All Prices

```json
GET /prices

[
    {"feed_id": "BTC-USD", "price": 10500000000000, "decimals": 8, "...": "..."},
    {"feed_id": "ETH-USD", "price": 380000000000, "decimals": 8, "...": "..."}
]
```

## Configuration

### YAML Configuration

```yaml
update_interval: 5s
publish_policy:
  threshold_bps: 10
  hysteresis_bps: 8
  min_interval: 3s
  max_per_minute: 30
default_sources: [binance, coinbase, okx]
feeds:
  - id: "BTC-USD"
    decimals: 8
    enabled: true
sources:
  - id: "binance"
    name: "Binance"
    url: "https://api.binance.com/api/v3/ticker/price?symbol={pair}"
    json_path: "price"
    weight: 1
  - id: "coinbase"
    name: "Coinbase"
    url: "https://api.coinbase.com/v2/prices/{base}-{quote}/spot"
    json_path: "data.amount"
    weight: 1
  - id: "okx"
    name: "OKX"
    url: "https://www.okx.com/api/v5/market/ticker?instId={pair}"
    json_path: "data.0.last"
    weight: 1
    pair_template: "{base}-{quote}"
    quote_override: "USDT"
```

### Required Secrets

| Secret | Description |
|--------|-------------|
| `NEOFEEDS_SIGNING_KEY` | ECDSA key for signing prices |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ARBITRUM_RPC` | Arbitrum RPC URL for Chainlink |

## Aggregation Algorithm

1. Fetch prices from all enabled sources
2. Calculate weighted median (weights are applied by repetition)
3. Sign result with the TEE-held key (`NEOFEEDS_SIGNING_KEY`)
4. Optionally persist to DB (if configured)

## Testing

```bash
go test ./services/datafeed/... -v -cover
```

Current test coverage: **61.5%**

## Version

- Service ID: `neofeeds`
- Version: `3.0.0`
