# GasBank Service

> Sponsored gas for seamless user transactions

## Overview

The GasBank Service enables MiniApps to sponsor GAS fees for users, removing the friction of requiring users to hold GAS tokens.

| Feature             | Description               |
| ------------------- | ------------------------- |
| **Gas Sponsorship** | Pay GAS fees for users    |
| **Quota System**    | Tiered daily limits       |
| **Auto-refill**     | Automatic quota reset     |
| **Usage Tracking**  | Monitor sponsorship usage |

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│   MiniApp   │────▶│   GasBank   │
│   Action    │     │   Request   │     │   Sponsor   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Neo N3    │
                                        │   Network   │
                                        └─────────────┘
```

## SDK Usage

```javascript
import { useGasSponsor } from "@neo/sdk";

const { requestSponsorship, getQuota } = useGasSponsor();

// Check available quota
const quota = await getQuota();

// Request sponsored transaction
const tx = await requestSponsorship({
    script: "...",
    signers: [{ account: userAddress }],
});
```

## Quota System

| Tier    | Daily Quota | Per-TX Limit |
| ------- | ----------- | ------------ |
| Free    | 0.1 GAS     | 0.01 GAS     |
| Basic   | 1 GAS       | 0.1 GAS      |
| Premium | 10 GAS      | 1 GAS        |

## Next Steps

- [Automation Service](./Automation-Service.md)
- [Payments API](../api-reference/REST-API.md)

## Integration Example

```typescript
import { useGasSponsor } from "@neo/uniapp-sdk";

const { getQuota, sponsor } = useGasSponsor();

// Check quota
const quota = await getQuota();
console.log(`Remaining: ${quota.remaining}`);

// Sponsor transaction
const tx = await sponsor({
    script: "...",
    signers: [{ account: userAddress }],
});
```
