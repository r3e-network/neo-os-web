# Guardian Policy

Automated portfolio protection policies

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-guardianpolicy` |
| **Category** | Governance |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Security
- Guardian
- Policy

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
| **Contract** | `0x893a774957244b83a0efed1d42771fe1e424cfec` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x893a774957244b83a0efed1d42771fe1e424cfec) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x451422cfb5a16e26a12f3222aa04fb669d978229` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x451422cfb5a16e26a12f3222aa04fb669d978229) |
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

### Creating a Protection Policy

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Select Assets**: Choose which assets to include in the protection policy
3. **Set Triggers**: Define conditions that trigger protective actions (price thresholds, time locks, etc.)
4. **Configure Actions**: Specify what happens when triggers are met (alerts, automatic transfers, freezes)
5. **Activate Policy**: Confirm and deploy your protection policy to the blockchain

### Managing Policies

1. View all active policies in your dashboard
2. Monitor trigger conditions and policy status
3. Edit or deactivate policies as needed
4. Review policy execution history

## How It Works

Guardian Policy provides automated portfolio protection through smart contracts:

1. **Condition Monitoring**: Policies continuously monitor on-chain conditions
2. **Trigger Detection**: When conditions are met, the policy automatically executes
3. **Protective Actions**: Actions can include notifications, asset transfers, or access restrictions
4. **Non-Custodial**: You retain full control of your assets at all times
5. **Customizable**: Create multiple policies with different triggers and actions
6. **On-Chain Security**: All policy logic and execution is transparent and verifiable

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
