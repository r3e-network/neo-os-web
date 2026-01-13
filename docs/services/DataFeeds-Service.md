# DataFeeds Service

> Real-time price feeds and market data

## Overview

The DataFeeds Service provides aggregated price data from multiple sources with low latency and high reliability.

| Feature          | Description               |
| ---------------- | ------------------------- |
| **Real-time**    | Sub-second price updates  |
| **Multi-source** | Aggregated from 10+ feeds |
| **WebSocket**    | Live streaming support    |
| **Historical**   | Access to price history   |

## Available Feeds

| Feed    | Description     | Update |
| ------- | --------------- | ------ |
| GAS-USD | GAS token price | 1s     |
| NEO-USD | NEO token price | 1s     |
| GAS-NEO | GAS/NEO pair    | 1s     |
| BTC-USD | Bitcoin price   | 1s     |
| ETH-USD | Ethereum price  | 1s     |

## SDK Usage

```javascript
import { useDatafeed } from "@neo/sdk";

const { getPrice, listFeeds, subscribe } = useDatafeed();

// Get single price
const price = await getPrice("GAS-USD");

// List all feeds
const feeds = await listFeeds();

// Real-time subscription
subscribe("GAS-USD", (update) => {
    console.log(update.value, update.timestamp);
});
```

## Response Format

```json
{
    "pair": "GAS-USD",
    "value": "5.23",
    "timestamp": "2026-01-11T00:00:00Z",
    "sources": 5
}
```

## Next Steps

- [Oracle Service](./Oracle-Service.md)
- [REST API](../api-reference/REST-API.md)

## Integration Example

```vue
<script setup lang="ts">
import { useDatafeed } from "@neo/uniapp-sdk";

const { prices, subscribe } = useDatafeed();

onMounted(() => {
    subscribe("GAS-USD");
});
</script>

<template>
    <div>GAS: ${{ prices["GAS-USD"]?.value }}</div>
</template>
```
