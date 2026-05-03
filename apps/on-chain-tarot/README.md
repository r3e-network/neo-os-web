# On-Chain Tarot

Blockchain fortune telling with verifiable randomness

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-onchaintarot` |
| **Category** | Gaming |
| **Version** | 1.0.0 |
| **Framework** | Host-native React playarea |

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
| **Contract** | `0x5cdf29c30727ce06696736ae0fb49abd9fd79730` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x5cdf29c30727ce06696736ae0fb49abd9fd79730) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xfb5d6b25c974a301e34c570dd038de8c25f3ae56` |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0xfb5d6b25c974a301e34c570dd038de8c25f3ae56) |
| **Network Magic** | `860833102` |

## Integration Notes

- **Funding model**: direct prepaid GAS to the MiniApp contract
- **Randomness / reading resolution**: Morpheus Oracle
- **Current wallet flow**: direct wallet invocation; AA/session-key optimization can be layered on later

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
3. **Prepay the Reading Fee**: Submit GAS directly to the MiniApp contract
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
6. **Payment Integration**: direct prepaid GAS funds the reading request; oracle callback credit is managed separately at the contract/integration layer

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
