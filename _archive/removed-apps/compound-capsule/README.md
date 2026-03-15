# Compound Capsule

Forced lock + auto-compound savings with penalty for early withdrawal

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-compound-capsule` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Savings
- Compound
- Time-lock

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
| **Contract** | `0x20397862ba24b84103a745ec2ed1f581126674dc` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x20397862ba24b84103a745ec2ed1f581126674dc) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x46852726d7c4a347991606ef1135e61d8112a175` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x46852726d7c4a347991606ef1135e61d8112a175) |
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

- **Allowed Assets**: NEO (for staking), GAS (for fees)

## Contract Methods

### User Methods

#### `CreateCapsule(owner, neoAmount, lockDays)`

Create a new time-locked savings capsule.

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | Hash160 | Owner wallet address |
| `neoAmount` | Integer | Amount of NEO to lock |
| `lockDays` | Integer | Lock duration in days |

#### `UnlockCapsule(capsuleId)`

Unlock a matured capsule and withdraw funds.

| Parameter | Type | Description |
|-----------|------|-------------|
| `capsuleId` | Integer | Capsule ID to unlock |

**Note**: Owner verification is done internally by the contract.

## Usage

### Creating a Capsule

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Select Amount**: Choose how much NEO to lock in the capsule
3. **Set Duration**: Specify the lock period in days
4. **Confirm Creation**: Review terms and confirm the transaction
5. **Monitor Growth**: Watch your savings grow through automatic compounding

### Unlocking a Capsule

1. Wait for the lock period to complete
2. Navigate to your active capsules
3. Click "Unlock" to withdraw your matured NEO plus rewards
4. **Early Withdrawal**: If you withdraw early, a penalty fee will be deducted

## How It Works

Compound Capsule uses time-locked savings with automatic compounding:

1. **Time Lock Mechanism**: Your NEO is locked for a specified period, preventing impulsive withdrawals
2. **Auto-Compounding**: Rewards are automatically reinvested during the lock period
3. **Penalty System**: Early withdrawal incurs a penalty to encourage long-term saving
4. **Smart Contract Security**: All operations are executed on-chain via audited smart contracts
5. **Yield Generation**: Locked NEO generates yield through Neo network participation

## License

MIT License - R3E Network
