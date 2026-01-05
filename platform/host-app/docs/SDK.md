# MiniApp SDK Guide

The MiniApp SDK provides a bridge between your application and the Neo MiniApp Platform services.

## Installation

```bash
npm install @neo/miniapp-sdk
```

## Quick Start

```typescript
import { NeoMiniAppSDK } from "@neo/miniapp-sdk";

const sdk = new NeoMiniAppSDK({
    appId: "your-app-id",
});

// Get user's wallet address
const address = await sdk.wallet.getAddress();
```

## Core Services

### Wallet

```typescript
// Get connected wallet address
const address = await sdk.wallet.getAddress();

// Invoke a transaction intent
const result = await sdk.wallet.invokeIntent(requestId);
```

### Payments

```typescript
// Pay GAS to the app
const tx = await sdk.payments.payGAS(appId, amount, memo);
```

### Randomness (VRF)

```typescript
// Request verifiable random number
const random = await sdk.rng.requestRandom(appId);
```

### Data Feeds

```typescript
// Get token price
const price = await sdk.datafeed.getPrice("NEO");
```

## Events

```typescript
// List events for your app
const events = await sdk.events.list({
    app_id: "your-app-id",
    limit: 20,
});
```

## Error Handling

```typescript
try {
    const result = await sdk.wallet.getAddress();
} catch (error) {
    if (error.code === "WALLET_NOT_CONNECTED") {
        // Handle wallet not connected
    }
}
```

## See Also

- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)
