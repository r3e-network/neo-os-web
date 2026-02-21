# Prediction Market

Trade on future outcomes and events

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-predictionmarket` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Prediction
- Trading
- Market

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ✅ Yes |
| Governance | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x64118096bd004a2bcb010f4371aba45121eca790` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x64118096bd004a2bcb010f4371aba45121eca790) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | Not deployed |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [NeoTube](https://neotube.io) |
| **Network Magic** | `860833102` |

## Platform Contracts

| Contract | Testnet Hash |
|----------|--------------|
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |

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
- **Max per TX**: 100 GAS
- **Daily Cap**: 1000 GAS

## License

MIT License - R3E Network
