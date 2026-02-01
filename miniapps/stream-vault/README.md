# Stream Vault

Time-based release vaults for payrolls, subscriptions, and recurring payments.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-stream-vault` |
| **Category** | defi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Lock GAS in a vault
- Fixed interval releases to a beneficiary
- Beneficiary claims on schedule
- Creator can cancel and reclaim remaining funds

## User Flow

1. **Create stream**: choose asset, total amount, release rate, and interval.
2. **Vault active**: funds stay locked until each interval unlocks releases.
3. **Claim**: beneficiary claims released amounts over time.
4. **Cancel (optional)**: creator cancels and receives remaining funds.

## Contract Methods

- `CreateStream(creator, beneficiary, asset, totalAmount, rateAmount, intervalSeconds, title, notes)`
- `ClaimStream(beneficiary, streamId)`
- `CancelStream(creator, streamId)`
- `GetStreamDetails(streamId)`
- `GetUserStreams(user, offset, limit)`
- `GetBeneficiaryStreams(beneficiary, offset, limit)`

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ❌ No |
| Automation | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | `https://testnet.neotube.io` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | `https://neotube.io` |

> Contract deployment is pending; `neo-manifest.json` keeps empty addresses until deployment.

## Usage

### Creating a Payment Stream

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Set Beneficiary**: Enter the wallet address of the recipient
3. **Define Terms**: Specify total amount, release rate, and interval duration
4. **Fund Stream**: Deposit the total GAS amount into the stream vault
5. **Activate**: Confirm and deploy the stream to the blockchain

### Claiming Streamed Payments

1. Beneficiary connects their wallet to the application
2. View all active streams where they are the beneficiary
3. Check available claimable amount based on elapsed time
4. Click "Claim" to withdraw available funds to their wallet
5. Return periodically to claim newly released funds

## How It Works

Stream Vault enables time-based payment distribution:

1. **Lock Funds**: Creator locks the full payment amount in the smart contract
2. **Time Release**: Funds unlock gradually based on the configured interval
3. **Linear Vesting**: Payments release at a constant rate over time
4. **Beneficiary Claims**: Recipient claims unlocked portions as they become available
5. **Cancel Option**: Creator can cancel the stream and reclaim remaining funds
6. **Transparency**: All stream parameters and claims are visible on-chain

## License

MIT License - R3E Network
