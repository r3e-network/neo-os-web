# Quick Start

> Get your first MiniApp running in 5 minutes

## Prerequisites

| Requirement | Version | Notes                         |
| ----------- | ------- | ----------------------------- |
| Node.js     | 18+     | LTS recommended               |
| pnpm        | 8+      | Package manager (recommended) |
| Neo Wallet  | -       | NeoLine, O3, OneGate, or Neon |
| TypeScript  | 5+      | Optional but recommended      |

## Project Structure

A typical MiniApp project structure:

```
my-miniapp/
├── src/
│   ├── pages/
│   │   └── index/
│   │       └── index.vue        # Main page
│   ├── shared/
│   │   ├── components/          # Reusable components
│   │   └── styles/
│   │       └── theme.scss       # Theme variables
│   ├── App.vue                  # Root component
│   └── main.ts                  # Entry point
├── neo-manifest.json            # App manifest (required)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Step 1: Install the SDK

```bash
# Using npm
npm install @neo/uniapp-sdk

# Using pnpm (recommended)
pnpm add @neo/uniapp-sdk

# Using bun
bun add @neo/uniapp-sdk
```

## Step 2: Initialize the SDK

```typescript
import { waitForSDK } from "@neo/uniapp-sdk";

async function init() {
    // Wait for the SDK to be injected by the host
    const sdk = await waitForSDK();

    // Check if wallet is connected
    const address = await sdk.wallet.getAddress();
    console.log("Connected wallet:", address);
}

init();
```

## Step 3: Make Your First API Call

```typescript
// Get current GAS price
const price = await sdk.datafeed.getPrice("GAS-USD");
console.log("GAS Price:", price.price);

// Request random number
const random = await sdk.rng.requestRandom("my-app-id");
console.log("Random:", random.randomness);
```

## Step 4: Create a Payment

```typescript
// Pay 0.1 GAS
const payment = await sdk.payments.payGAS(
    "my-app-id",
    "0.1",
    "Payment for service",
);
console.log("Payment request:", payment.request_id);
```

## Complete Example

```typescript
import { waitForSDK } from "@neo/uniapp-sdk";

async function main() {
    const sdk = await waitForSDK();

    // Get wallet address
    const address = await sdk.wallet.getAddress();
    console.log("Wallet:", address);

    // Get price feed
    const gasPrice = await sdk.datafeed.getPrice("GAS-USD");
    console.log("GAS/USD:", gasPrice.price);

    // Generate random number
    const rng = await sdk.rng.requestRandom("my-app");
    console.log("Random:", rng.randomness);
}

main().catch(console.error);
```

## Next Steps

- [Authentication](./Authentication.md) - Learn about auth flows
- [API Keys](./API-Keys.md) - Get your API credentials
- [JavaScript SDK](../sdks/JavaScript-SDK.md) - Full SDK reference

## Manifest Configuration

Create `neo-manifest.json` in your project root:

```json
{
    "app_id": "my-miniapp",
    "name": "My MiniApp",
    "version": "1.0.0",
    "description": "A sample Neo MiniApp",
    "permissions": {
        "payments": true,
        "rng": true,
        "datafeed": true,
        "governance": false,
        "secrets": false
    },
    "icon": "./static/icon.svg",
    "entry": "./index.html"
}
```

## Using Vue Composables

The SDK provides Vue 3 composables for reactive state management:

```vue
<script setup lang="ts">
import { useWallet, useDatafeed, useRNG } from "@neo/uniapp-sdk";

// Wallet composable
const { address, isConnected, connect } = useWallet();

// DataFeed composable
const { getPrice, prices } = useDatafeed();

// RNG composable
const { requestRandom, isLoading } = useRNG();

// Fetch price on mount
onMounted(async () => {
    await getPrice("GAS-USD");
});
</script>

<template>
    <div>
        <p v-if="isConnected">Wallet: {{ address }}</p>
        <p>GAS Price: {{ prices["GAS-USD"]?.value }}</p>
        <button @click="requestRandom({ min: 1, max: 100 })">Roll Dice</button>
    </div>
</template>
```

## Error Handling

Always wrap SDK calls in try-catch:

```typescript
try {
    const result = await sdk.payments.payGAS("app-id", "1.0", "memo");
    console.log("Success:", result);
} catch (error) {
    if (error.code === "USER_REJECTED") {
        console.log("User cancelled the transaction");
    } else if (error.code === "INSUFFICIENT_FUNDS") {
        console.log("Not enough GAS");
    } else {
        console.error("Unexpected error:", error);
    }
}
```

## Troubleshooting

| Issue                | Solution                                  |
| -------------------- | ----------------------------------------- |
| SDK not initialized  | Ensure `waitForSDK()` completes first     |
| Wallet not connected | Call `connect()` before wallet operations |
| Permission denied    | Check manifest permissions                |
| Rate limit exceeded  | Wait and retry with exponential backoff   |
