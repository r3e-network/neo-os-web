# Graveyard

Encrypted memory burial with paid forgetting

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-graveyard` |
| **Category** | Utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Memorialize**: Create permanent tributes to lost projects or addresses
2. **Tombstone Design**: Choose from various tombstone designs and inscriptions
3. **On-Chain Record**: Memorials are permanently recorded on Neo blockchain
4. **Verify Loss**: Optionally verify the loss through oracle attestation
5. **Public View**: All memorials are publicly viewable and searchable
## Features

- Encrypted hashes
- Paid forgetting
- TEE key destruction

## Usage Flow

1. Enter the encrypted content hash and select a memory type.
2. Pay the burial fee to anchor the hash on-chain.
3. Optional: pay the forgetting fee to erase the hash and trigger TEE key destruction.

## Fees

- Burial fee: 0.1 GAS
- Forgetting fee: 1 GAS

## Memory Types

- Secret, Regret, Wish, Confession, Other

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
| **Contract** | `0x8cf45cdc1d879710c2b88fd8705696fe6f5aacb5` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x8cf45cdc1d879710c2b88fd8705696fe6f5aacb5) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x0195e668f7a2a41ef4a0200c5b9c2cc1c02e24d1` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x0195e668f7a2a41ef4a0200c5b9c2cc1c02e24d1) |
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
