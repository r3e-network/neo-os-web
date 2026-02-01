# MiniApp SDK Guide

The MiniApp SDK is injected by the host app and provides a safe bridge to MiniApp platform services.
MiniApps should **never** construct or sign transactions directly.

Use `@r3e/uniapp-sdk` in UniApp/Vue, or access `window.MiniAppSDK` directly in other frameworks.
The SDK source is maintained in this repo at `packages/@neo/uniapp-sdk` and published to npm as `@r3e/uniapp-sdk`.

## Installation (UniApp/Vue)

```bash
pnpm add @r3e/uniapp-sdk
```

## Quick Start (UniApp/Vue)

```typescript
import { useWallet, usePayments } from "@r3e/uniapp-sdk";

const APP_ID = "miniapp-my-app"; // must match manifest app_id

const { address, connect } = useWallet();
const { payGAS } = usePayments(APP_ID);

await connect();
const walletAddress = address.value;
```

## Quick Start (Any Framework)

```typescript
import { waitForSDK } from "@r3e/uniapp-sdk";

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

// Sign an arbitrary message (requires confidential permission)
const signature = await sdk.wallet.signMessage("hello");
```

### Payments

```typescript
// Create a payment intent (returns invocation details)
const intent = await sdk.payments.payGAS(appId, amount, memo);
await sdk.wallet.invokeIntent(intent.request_id);

// Or, submit in one step
const tx = await sdk.payments.payGASAndInvoke(appId, amount, memo);
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

## Submission Pipeline

MiniApps are registered through the submission pipeline. Submit your GitHub repo for review and
approval; internal miniapps in `git@github.com:r3e-network/miniapps.git` are auto-approved and published.

## See Also

- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)
