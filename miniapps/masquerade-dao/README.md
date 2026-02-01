# Masquerade DAO

Anonymous DAO voting with mask identities

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-masqueradedao` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Dao
- Anonymous
- Voting

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
| **Contract** | `0x07ff6bac7e2824d1cec0e71a1383d131cdf86c65` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x07ff6bac7e2824d1cec0e71a1383d131cdf86c65) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xc5e3e2e481af11dc823ae4ebcd8f791b9ba9b6f9` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xc5e3e2e481af11dc823ae4ebcd8f791b9ba9b6f9) |
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

### Participating in Anonymous Voting

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Acquire Mask**: Purchase or receive a mask identity token
3. **Join Proposal**: Enter an active DAO proposal room
4. **Cast Vote**: Submit your anonymous vote (For/Against/Abstain)
5. **Verify**: Confirm your vote was recorded without revealing identity

### Creating Proposals

1. Submit a new proposal with title and description
2. Set voting duration and quorum requirements
3. Define the execution action if passed
4. Announce to the DAO community

## How It Works

Masquerade DAO enables anonymous voting through mask identities:

1. **Mask Minting**: Users acquire unique mask NFTs that serve as voting credentials
2. **Identity Separation**: The mask is separate from the wallet, preserving anonymity
3. **One Mask One Vote**: Each mask can vote once per proposal
4. **Zero-Knowledge Verification**: Votes are verified without linking to real identities
5. **Proposal Execution**: Passed proposals execute automatically via smart contracts
6. **Transparent Results**: Vote counts are public while individual voters remain anonymous

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
