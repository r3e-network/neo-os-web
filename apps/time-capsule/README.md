# Time Capsule

Time-locked message hashes with public fishing and local content storage

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-time-capsule` |
| **Category** | nft |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |


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
| **Contract** | `0x0108b2d8d020f921d9bdc82ffda5e55f9b749823` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x0108b2d8d020f921d9bdc82ffda5e55f9b749823) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xd853a4ac293ff96e7f70f774c2155d846f91a989` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xd853a4ac293ff96e7f70f774c2155d846f91a989) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Testnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` |

### Mainnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| ServiceLayerGateway | `0x7f73ae3036c1ca57cad0d4e4291788653b0fa7d7` |

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
