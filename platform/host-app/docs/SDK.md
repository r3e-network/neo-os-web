# MiniApp SDK Guide

The MiniApp SDK is injected by the host app and provides a safe bridge to MiniApp platform services.
MiniApps should **never** construct or sign transactions directly.

Use `@neo/uniapp-sdk` in UniApp/Vue, or access `window.MiniAppSDK` directly in other frameworks.
The SDK source is maintained in this repo at `packages/@neo/uniapp-sdk` and published to npm.

## Installation (UniApp/Vue)

```bash
pnpm add @neo/uniapp-sdk
```

## Quick Start (UniApp/Vue)

```typescript
import { useWallet, usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-my-app"; // must match manifest app_id

const { address, connect } = useWallet();
const { payGAS } = usePayments(APP_ID);

await connect();
const walletAddress = address.value;
```

## Quick Start (Any Framework)

```typescript
import { waitForSDK } from "@neo/uniapp-sdk";

const sdk = await waitForSDK();
const address = await sdk.wallet.getAddress();
```

## Core Services

### Wallet

```typescript
// Get connected wallet address
const address = await sdk.wallet.getAddress();

// Invoke a transaction intent (optional, host-specific)
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
const random = await sdk.rng.requestRandom(APP_ID);
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

## UniversalMiniApp Contract

If you need on-chain events, storage, or metrics, set `supported_chains` and
`contracts.<chain>.address` in your manifest (for example `neo-manifest.json`) to the
UniversalMiniApp contract address for each supported chain. If you do not emit on-chain
events, you may omit addresses for those chains.
Ensure `app_id` matches the `APP_ID` constant used in your MiniApp so SDK calls
and payment workflows resolve correctly.

## Auto-Registration

MiniApps are auto-registered. Add a folder under `miniapps-uniapp/apps/<your-app>` with a
manifest file (`neo-manifest.json`) and run:

```bash
node miniapps-uniapp/scripts/auto-discover-miniapps.js
```

The host app runs this automatically during `predev` and `prebuild`.

## See Also

- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)
