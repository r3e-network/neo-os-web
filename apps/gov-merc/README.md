# Gov Merc

Governance mercenary - vote rental marketplace like Curve War

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-gov-merc` |
| **Category** | Governance |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Governance
- Voting
- Marketplace

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ✅ Yes |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x05d4ed2e60141043d6d20f5cde274704bd42c0dc` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x05d4ed2e60141043d6d20f5cde274704bd42c0dc) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xe8f3d8d5784f8570d1f806940bbaa7daff9f52d0` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0xe8f3d8d5784f8570d1f806940bbaa7daff9f52d0) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Current Integration Surface

- direct prepaid GAS to the MiniApp contract
- direct contract invocation only
- governance logic remains on-chain; Oracle / AA integrations stay external

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

### Creating Vote Listings

1. **Connect Wallet**: Link your Neo N3 wallet with governance tokens
2. **Create Offer**: Specify how many votes you're willing to sell/rent
3. **Set Price**: Determine the GAS price per vote
4. **Set Duration**: Define the rental period or sale terms
5. **Publish**: List your votes on the marketplace

### Acquiring Votes

1. Browse available vote listings from council members
2. Select a listing that meets your needs
3. Prepay the specified GAS amount directly to the MiniApp contract
4. Use acquired votes to influence governance proposals
5. Votes automatically return to owner after rental period

## How It Works

Gov Merc creates a marketplace for governance voting power:

1. **Vote Tokenization**: Governance voting rights are represented as transferable tokens
2. **Marketplace Matching**: Sellers list votes; buyers browse and purchase voting power
3. **Smart Contract Escrow**: Votes are held in escrow during the rental period
4. **Automatic Return**: Rented votes automatically return to the owner after expiry
5. **Curve War Mechanics**: Projects can acquire voting power to influence protocol decisions
6. **Transparency**: All listings and transactions are visible on-chain

## Assets

- **Allowed Assets**: GAS

## Funding Model

- direct prepaid GAS to the MiniApp contract
- direct contract invocation only
- wallet signs the transfer first, then calls `placeBid`


## License

MIT License - R3E Network
