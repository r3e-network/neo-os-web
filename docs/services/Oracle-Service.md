# Oracle Service

> Decentralized price oracle for on-chain data feeds

## Overview

The Oracle Service provides reliable, tamper-proof price data from multiple sources, aggregated within TEE enclaves.

| Feature          | Description                      |
| ---------------- | -------------------------------- |
| **Multi-source** | Aggregates from 10+ data sources |
| **TEE-secured**  | Processed in secure enclaves     |
| **Low latency**  | Sub-second price updates         |
| **Tamper-proof** | Cryptographic attestation        |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Oracle Service                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ Binance │  │Coinbase │  │ Uniswap │  │Chainlink│    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │
│       │            │            │            │          │
│       └────────────┴─────┬──────┴────────────┘          │
│                          ▼                              │
│              ┌───────────────────┐                      │
│              │  TEE Aggregator   │                      │
│              │  (Median Filter)  │                      │
│              └─────────┬─────────┘                      │
│                        ▼                                │
│              ┌───────────────────┐                      │
│              │  Signed Output    │                      │
│              └───────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

## Data Sources

| Source    | Type   | Update Frequency |
| --------- | ------ | ---------------- |
| Binance   | CEX    | 1 second         |
| Coinbase  | CEX    | 1 second         |
| Uniswap   | DEX    | Per block        |
| Chainlink | Oracle | Heartbeat        |

## Supported Pairs

- GAS/USD, NEO/USD, GAS/NEO
- BTC/USD, ETH/USD
- Major stablecoins

## SDK Usage

```javascript
import { useDatafeed } from "@neo/sdk";

const { getPrice, subscribe } = useDatafeed();

// Get current price
const price = await getPrice("GAS-USD");
console.log(price.value, price.timestamp);

// Subscribe to updates
subscribe("GAS-USD", (update) => {
    console.log("New price:", update.value);
});
```

## Aggregation

Prices are aggregated using median filtering:

```
Sources: [5.20, 5.21, 5.19, 5.25, 5.18]
Median:  5.20
```

## Next Steps

- [DataFeeds Service](./DataFeeds-Service.md)
- [API Reference](../api-reference/REST-API.md)

## Integration Example

```typescript
import { useDatafeed } from "@neo/uniapp-sdk";

const { getPrice, subscribe } = useDatafeed();

// One-time price fetch
const price = await getPrice("GAS-USD");
console.log(`Price: ${price.value}`);

// Real-time subscription
subscribe("GAS-USD", (update) => {
    updateUI(update.value);
});
```

## Best Practices

| Practice          | Description                |
| ----------------- | -------------------------- |
| Cache prices      | Reduce API calls           |
| Handle stale data | Check timestamp freshness  |
| Use subscriptions | For real-time requirements |
