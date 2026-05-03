# Time Capsule

Time-locked message hashes with public fishing and local content storage

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-time-capsule` |
| **Category** | nft |
| **Version** | 1.0.0 |
| **Framework** | Host-native React playarea |


## How It Works

1. **Create Capsule**: Seal messages or digital assets in a time capsule
2. **Set Release Time**: Define when the capsule can be opened
3. **On-Chain Storage**: Capsule metadata is stored permanently on Neo
4. **Restricted Access**: Cannot be opened before the release time
5. **Claim Capsule**: After release time, the owner can claim contents
## Features

- Store message hashes on-chain while keeping full content locally
- Choose public or private visibility
- Public capsules can be fished after unlock
- Add recipients to private capsules
- Extend unlock time or gift capsules (fees apply)
- On-chain stats for users and categories

## Usage Flow

1. Connect your Neo wallet and open the Create tab.
2. Enter a message, set a lock duration (1-3650 days), and choose visibility.
3. Pay the 0.2 GAS fee to seal the capsule hash on-chain.
4. Reveal your capsule after unlock using your local backup.
5. Optional: fish for unlocked public capsules with a small fee.

## Content Storage

- The contract only stores the message hash and metadata.
- The full message stays on your device. Back it up if you want to reveal it later.

## Fees

- Bury capsule: 0.2 GAS
- Fish capsule: 0.05 GAS
- Extend unlock time: 0.1 GAS
- Gift capsule: 0.15 GAS
- Fishing reward: 0.02 GAS when contract balance allows

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x0c6abb9ddeaceb55bb17f6d3c5a26d0814773489` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x0c6abb9ddeaceb55bb17f6d3c5a26d0814773489) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xd853a4ac293ff96e7f70f774c2155d846f91a989` |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0xd853a4ac293ff96e7f70f774c2155d846f91a989) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Current Integration Surface

- direct prepaid GAS to the MiniApp contract
- direct contract invocation for bury / fish
- optional Oracle / AA integrations remain external

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
