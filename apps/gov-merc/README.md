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
| **Contract** | `0x69a013c8fde3e835d642717ef1af71f7e02ade00` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x69a013c8fde3e835d642717ef1af71f7e02ade00) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xe8f3d8d5784f8570d1f806940bbaa7daff9f52d0` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xe8f3d8d5784f8570d1f806940bbaa7daff9f52d0) |
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

### Creating Vote Listings

1. **Connect Wallet**: Link your Neo N3 wallet with governance tokens
2. **Create Offer**: Specify how many votes you're willing to sell/rent
3. **Set Price**: Determine the GAS price per vote
4. **Set Duration**: Define the rental period or sale terms
5. **Publish**: List your votes on the marketplace

### Acquiring Votes

1. Browse available vote listings from council members
2. Select a listing that meets your needs
3. Pay the specified GAS amount to acquire voting rights
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


## License

MIT License - R3E Network
