# Automation Service

> Scheduled task execution and event-driven automation

## Overview

The Automation Service enables MiniApps to schedule recurring tasks and respond to on-chain events automatically.

| Feature            | Description              |
| ------------------ | ------------------------ |
| **Cron Jobs**      | Schedule recurring tasks |
| **Event Triggers** | React to on-chain events |
| **Webhooks**       | HTTP callbacks           |
| **Retry Logic**    | Automatic failure retry  |

## Features

- **Cron Jobs** - Schedule recurring tasks
- **Event Triggers** - React to on-chain events
- **Webhooks** - HTTP callbacks on completion

## SDK Usage

### Schedule a Task

```javascript
import { useAutomation } from "@neo/sdk";

const { schedule } = useAutomation();

await schedule({
    name: "daily-reward",
    cron: "0 0 * * *", // Daily at midnight
    action: "distribute_rewards",
});
```

### Event Trigger

```javascript
const { onEvent } = useAutomation();

onEvent("transfer", {
    contract: "0x...",
    callback: async (event) => {
        console.log("Transfer detected:", event);
    },
});
```

## Manifest Declaration

```json
{
    "permissions": {
        "automation": true
    }
}
```

## Next Steps

- [GasBank Service](./GasBank-Service.md)
- [Capabilities System](../architecture/Capabilities-System.md)

## Integration Example

```typescript
import { useAutomation } from "@r3e/uniapp-sdk";

const { schedule, cancel } = useAutomation();

// Daily reward distribution
const job = await schedule({
    name: "daily-rewards",
    cron: "0 0 * * *",
    action: "distribute",
});

// Cancel if needed
await cancel(job.id);
```
