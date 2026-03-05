# On-Chain Tarot

Blockchain fortune telling with verifiable randomness

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-onchaintarot` |
| **Category** | Gaming |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Tarot
- Fortune
- Divination

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
| **Contract** | `0xfff9616dd3d9e863bc72bf26ff0a0da2d698e767` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xfff9616dd3d9e863bc72bf26ff0a0da2d698e767) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xfb5d6b25c974a301e34c570dd038de8c25f3ae56` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xfb5d6b25c974a301e34c570dd038de8c25f3ae56) |
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

### Getting a Tarot Reading

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Focus Your Question**: Think about what guidance you seek
3. **Pay Fee**: Submit GAS payment for the reading
4. **Draw Cards**: The smart contract draws cards using verifiable randomness
5. **Receive Reading**: View your cards and their interpretations on-chain

### Understanding Your Reading

1. View drawn cards with their positions (Past, Present, Future, etc.)
2. Read the meaning of each card as revealed by the contract
3. Consider the combined interpretation of all cards
4. Save or share your reading as a permanent blockchain record

## How It Works

On-Chain Tarot combines ancient divination with blockchain technology:

1. **Verifiable Randomness**: Card draws use cryptographically secure randomness from the blockchain
2. **Immutable Record**: Each reading is permanently recorded on Neo N3
3. **Fair Drawing**: No one can predict or manipulate the card selection
4. **Smart Contract Interpretation**: Card meanings are stored and interpreted on-chain
5. **Transparent Process**: The entire drawing process is auditable and verifiable
6. **Payment Integration**: GAS payments fund the randomness oracle and platform

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
