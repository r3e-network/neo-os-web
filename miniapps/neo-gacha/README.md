# Neo Gacha

On-chain blind box marketplace with escrowed prizes, transparent odds, and verifiable randomness.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-gacha` |
| **Category** | Gaming |
| **Version** | 2.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Acquire Gacha**: Use GAS to operate gacha machines
2. **Random Drop**: Characters are selected using on-chain randomness
3. **Rarity System**: Different characters have different rarity levels
4. **Collection**: Build your collection of unique characters
5. **Trade**: Characters can be transferred or traded
## Features

- Creator-built gacha machines with escrowed inventory
- Pay-to-play spins using GAS (PaymentHub receipts)
- Verifiable randomness via ServiceLayerGateway
- Machine marketplace (list, manage, trade, rank)
- On-chain audit trail of spins and sales
- Inventory deposit/withdraw flows for NEP-17 and NEP-11

## Usage Flow

1. Create a machine in Creator Studio.
2. Deposit prizes via the Manage tab.
3. Activate and list the machine for players.

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ✅ Yes |
| Data Feed | ❌ No |
| Governance | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x38f050f88deab96ac6bf5d1f197dd8f5d71182fc` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x38f050f88deab96ac6bf5d1f197dd8f5d71182fc) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xc9af7c9de5b0963e6514b6462b293f0179eb3798` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xc9af7c9de5b0963e6514b6462b293f0179eb3798) |
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
pnpm install

# Development server
pnpm dev --filter miniapp-neo-gacha

# Build for H5
pnpm build --filter miniapp-neo-gacha
```

## Assets

- **Allowed Assets**: NEP-17, NEP-11 (escrowed in contract)
- **Odds**: Must sum to 100% before activation

## License

MIT License - R3E Network
