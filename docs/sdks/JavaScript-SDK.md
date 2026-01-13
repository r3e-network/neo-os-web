# JavaScript SDK

> Official JavaScript/TypeScript SDK for the Neo Service Layer

## Overview

The JavaScript SDK provides a type-safe interface for interacting with all Neo Service Layer APIs.

| Feature           | Description                 |
| ----------------- | --------------------------- |
| **TypeScript**    | Full type definitions       |
| **Tree-shakable** | Import only what you need   |
| **Async/Await**   | Promise-based API           |
| **Auto-retry**    | Built-in retry with backoff |

## Installation

```bash
npm install @neo/service-layer-sdk
# or
yarn add @neo/service-layer-sdk
# or
pnpm add @neo/service-layer-sdk
```

## Quick Start

```typescript
import { NeoClient } from "@neo/service-layer-sdk";

const client = new NeoClient({
    apiKey: "YOUR_API_KEY",
    network: "mainnet",
});

// Get price feed
const price = await client.datafeed.getPrice("GAS-USD");
console.log(`GAS Price: ${price.value}`);
```

## Configuration

```typescript
const client = new NeoClient({
    apiKey: "YOUR_API_KEY",
    network: "testnet",
    timeout: 30000,
    retries: 3,
});
```

## Services

### DataFeed

```typescript
// Get price
const price = await client.datafeed.getPrice("GAS-USD");

// List feeds
const feeds = await client.datafeed.listFeeds();

// Subscribe to updates
client.datafeed.subscribe("GAS-USD", (update) => {
    console.log("New price:", update.value);
});
```

### VRF (Randomness)

```typescript
// Request random number
const result = await client.vrf.requestRandom({
    min: 1,
    max: 100,
});

// Verify proof
const isValid = await client.vrf.verify(result.proof);
```

### Payments

```typescript
// Send GAS
const tx = await client.payments.sendGAS({
    to: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    amount: "1.5",
});

// Check status
const status = await client.payments.getStatus(tx.id);
```

### Governance

```typescript
// Get council members
const members = await client.governance.getMembers();

// Vote for candidate
await client.governance.vote({
    candidate: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    amount: "100",
});
```

### Secrets

```typescript
// Store secret
await client.secrets.store({
    key: "api-key",
    value: "sk_live_xxx",
});

// Get secret
const secret = await client.secrets.get("api-key");
```

## Error Handling

```typescript
import { APIError, RateLimitError } from "@neo/service-layer-sdk";

try {
    await client.datafeed.getPrice("INVALID");
} catch (error) {
    if (error instanceof RateLimitError) {
        console.log(`Retry after: ${error.retryAfter}s`);
    } else if (error instanceof APIError) {
        console.log(`Error ${error.code}: ${error.message}`);
    }
}
```

## Next Steps

- [Go SDK](./Go-SDK.md)
- [Python SDK](./Python-SDK.md)
- [CLI Tool](./CLI-Tool.md)

## TypeScript Types

```typescript
interface NeoClientConfig {
    apiKey: string;
    network: "mainnet" | "testnet";
    timeout?: number;
    retries?: number;
}

interface PriceData {
    pair: string;
    value: string;
    timestamp: string;
    sources: number;
}

interface RandomResult {
    id: string;
    value: number;
    proof: string;
    timestamp: string;
}
```

## Browser vs Node.js

The SDK works in both environments:

```typescript
// Browser (with bundler)
import { NeoClient } from "@neo/service-layer-sdk";

// Node.js (CommonJS)
const { NeoClient } = require("@neo/service-layer-sdk");

// Node.js (ESM)
import { NeoClient } from "@neo/service-layer-sdk";
```
