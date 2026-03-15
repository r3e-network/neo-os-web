# Garden of Neo

Blockchain garden with 100-block growth and GAS harvest rewards

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-garden-of-neo` |
| **Category** | nft |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Plant Seeds**: Users acquire and plant digital seeds
2. **Growth Cycle**: Plants grow over time with user interaction
3. **Harvest**: Mature plants produce harvestable rewards
4. **Cross-Pollination**: Some plants can cross-breed for unique variants
5. **Marketplace**: Trade plants and seeds with other users
## Features

- Plant elemental seeds (Fire, Ice, Earth, Wind, Light)
- Plants mature after 100 blocks
- Harvest once for GAS rewards (0.15-0.30 per seed)
- On-chain events for planting and harvesting

## Usage Flow

1. Connect your Neo wallet.
2. Plant a seed for 0.1 GAS.
3. Wait about 100 blocks for maturity.
4. Harvest to claim GAS rewards and replant.

## Seed Rewards (Current UI)

| Seed | Reward |
|------|--------|
| Fire | 0.15 GAS |
| Ice | 0.15 GAS |
| Earth | 0.20 GAS |
| Wind | 0.20 GAS |
| Light | 0.30 GAS |

## Fees

- Planting fee: 0.1 GAS per seed
- Harvest: no additional fee

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| Data Feed | ✅ Yes |
| RNG | ❌ No |
| Governance | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x192e2a0a1e050440b97d449b7905f37516042faa` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x192e2a0a1e050440b97d449b7905f37516042faa) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x72aa16fd44305eabe8b85ca397b9bfcdc718dce8` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x72aa16fd44305eabe8b85ca397b9bfcdc718dce8) |
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

## Notes

- The current UI focuses on planting and harvesting only.

## License

MIT License - R3E Network
