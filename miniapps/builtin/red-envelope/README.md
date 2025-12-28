# Red Envelope (红包)

WeChat-style Lucky Red Packets - Social GAS distribution with VRF randomness and Best Luck Winner.

## Overview

Red Envelope brings the traditional Chinese lucky red packet (红包) to Neo N3, featuring WeChat-style random distribution where each recipient gets a different random amount, and the person who gets the highest amount is crowned the "Best Luck Winner" (手气最佳).

## Features

- **Random Distribution**: VRF-powered random amounts (like WeChat)
- **Best Luck Winner**: 👑 Crown the person who gets the highest amount
- **One Grab Per User**: Each user can only grab once per envelope
- **Grabber Tracking**: See who grabbed what amount
- **Completion Notification**: Alert when all packets are claimed
- **Share Links**: Send claim codes to recipients
- **Time Limits**: Set expiry for unclaimed packets
- **Refund Unclaimed**: Get back expired GAS

## How It Works (WeChat-style)

1. **Create Envelope**: Deposit GAS (0.1-100) and set packet count
2. **Share Code**: Send the 6-character code to friends
3. **Recipients Grab**: Each person grabs once, gets random amount
4. **Best Luck Revealed**: When all packets claimed, winner is announced

```
Create → Fund → Share → Grab → Complete
   ↓       ↓       ↓       ↓        ↓
Set amt  PayGAS  Code   VRF amt  👑 Best Luck
```

## Distribution Modes

| Mode       | Description                                |
| ---------- | ------------------------------------------ |
| **Random** | VRF assigns varying amounts (WeChat-style) |
| **Equal**  | Same amount per recipient                  |

## Best Luck Winner (手气最佳)

When all packets are claimed:

- The person with the highest amount is crowned 👑 Best Luck Winner
- A modal displays all grabbers ranked by amount
- Platform notification is sent to announce the winner

## Technical Details

### Smart Contract Events

| Event               | Description                           |
| ------------------- | ------------------------------------- |
| `EnvelopeCreated`   | New envelope created with total/count |
| `EnvelopeClaimed`   | User claimed a packet                 |
| `EnvelopeCompleted` | All packets claimed, best luck winner |

### Platform Capabilities Used

| Capability        | Usage                          |
| ----------------- | ------------------------------ |
| **Payments**      | Envelope funding and claims    |
| **RNG**           | VRF random amount distribution |
| **Notifications** | Best luck winner announcement  |

### Data Structure

```javascript
envelope = {
  code: "ABC123",
  totalAmount: 100000000,  // in raw units (1e8)
  packets: [amounts...],   // remaining packet amounts
  remaining: 5,            // packets left
  creator: "NXxx...",
  type: "random",
  createdAt: timestamp,
  grabbers: [              // WeChat-style tracking
    { address: "NXxx...", amount: 20000000, timestamp: ... }
  ],
  bestLuck: {              // Best luck winner
    address: "NXxx...",
    amount: 35000000
  }
}
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "rng": true,
    "notifications": true
  },
  "assets_allowed": ["GAS"]
}
```

## Development

```bash
npx serve miniapps/builtin/red-envelope
```

## Related Apps

- [GAS Circle](../gas-circle/) - Community savings
- [Lottery](../lottery/) - Random winner selection
