# Million Piece Map

Collaborative world map ownership game

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-millionpiecemap` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Map
- Ownership
- Trading

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
| **Contract** | `0xf4ab0fa6f245427482cb5c693a5f40baf6d58c71` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xf4ab0fa6f245427482cb5c693a5f40baf6d58c71) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xdae609b67e51634a95badea92bae585459fe83a4` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xdae609b67e51634a95badea92bae585459fe83a4) |
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

## Usage

### Claiming Map Pieces

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Browse Map**: Explore the world map divided into claimable pieces
3. **Select Piece**: Choose an available piece to claim
4. **Pay Fee**: Submit the required GAS to claim ownership
5. **Personalize**: Add your name, message, or color to your piece

### Trading Pieces

1. View your owned pieces in your portfolio
2. List pieces for sale at your desired price
3. Browse pieces listed by other users
4. Purchase pieces to expand your territory

## How It Works

Million Piece Map creates a collaborative ownership game:

1. **World Division**: The world map is divided into millions of unique, ownable pieces
2. **Ownership NFTs**: Each piece is represented as an NEP-11 NFT
3. **Claim System**: Unowned pieces can be claimed by paying a fee
4. **Transferable**: Owners can sell or trade their pieces freely
5. **Visual Representation**: The map updates in real-time showing ownership
6. **Community Creation**: Together, users create a collaborative digital artwork

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
