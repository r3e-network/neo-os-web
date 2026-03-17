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
2. Prepay the burial fee directly to the MiniApp contract and anchor the hash on-chain.
3. Optional: prepay the forgetting fee directly to the MiniApp contract, erase the hash, and trigger TEE key destruction.

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

### Current Integration Surface

- direct prepaid GAS to the MiniApp contract
- no PaymentHub receipt path
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

## Funding Model

- direct prepaid GAS to the MiniApp contract
- no PaymentHub receipt path
- wallet signs the transfer first, then the business call


## License

MIT License - R3E Network
