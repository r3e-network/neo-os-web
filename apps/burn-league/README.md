# Burn League

Burn-to-earn league - destroy GAS for platform equity

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-burn-league` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Burn
- Deflationary
- Rewards

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
| **Contract** | `0x8db1b8c67b52e02592d2ee7ceb47dea908ab0e46` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x8db1b8c67b52e02592d2ee7ceb47dea908ab0e46) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xd829b7a8c0d9fa3c67a29c703a277de3f922f173` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xd829b7a8c0d9fa3c67a29c703a277de3f922f173) |
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

### Burning GAS

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Enter Amount**: Specify how much GAS you want to burn (minimum 1 GAS)
3. **Confirm Transaction**: Review and sign the burn transaction
4. **Earn Rewards**: Receive platform equity proportional to your burn contribution

### Viewing Stats

1. Navigate to the Stats tab to see total GAS burned
2. Check your personal burn statistics and rank
3. View the global leaderboard to see top burners
4. Monitor the reward pool distribution

## How It Works

Burn League operates on a deflationary tokenomics model:

1. **Token Burning**: Users permanently destroy GAS tokens by sending them to the burn contract
2. **Leaderboard System**: All burns are tracked and ranked on a public leaderboard
3. **Reward Distribution**: Platform equity is distributed to burners based on their contribution
4. **Deflationary Effect**: As GAS is burned, the circulating supply decreases, potentially increasing value
5. **Transparency**: All burn events are recorded on-chain and publicly verifiable

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
