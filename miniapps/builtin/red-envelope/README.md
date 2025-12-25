# Red Envelope

Web3 Lucky Red Packets - Social GAS distribution with VRF randomness.

## Overview

Red Envelope brings the traditional lucky red packet to Neo N3. Create GAS packets for friends, family, or community members with VRF-powered random distribution.

## Features

- **Create Packets**: Fund envelopes with GAS
- **Random Amounts**: VRF distributes varying amounts
- **Share Links**: Send claim links to recipients
- **Time Limits**: Set expiry for unclaimed packets
- **Refund Unclaimed**: Get back expired GAS

## How It Works

1. **Create Envelope**: Deposit GAS (0.1-100)
2. **Set Recipients**: Choose number of packets
3. **Share Link**: Send to friends
4. **Recipients Claim**: VRF determines amount
5. **Expire/Refund**: Unclaimed returns to sender

## Distribution Modes

| Mode       | Description                 |
| ---------- | --------------------------- |
| **Random** | VRF assigns varying amounts |
| **Equal**  | Same amount per recipient   |
| **Lucky**  | One big winner, rest small  |

## Technical Details

### Platform Capabilities Used

| Capability   | Usage                       |
| ------------ | --------------------------- |
| **Payments** | Envelope funding and claims |
| **RNG**      | VRF amount distribution     |

### Envelope Lifecycle

```
Create → Fund → Share → Claim → Expire
   ↓       ↓       ↓       ↓       ↓
Set params PayToApp Gen link VRF amt Refund
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "rng": true
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
