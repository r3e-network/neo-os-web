# Unbreakable Vault

Hacker bounty vaults secured by SHA-256 hashes

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-unbreakablevault` |
| **Category** | utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Deposit Assets**: Send GAS or NEO to the vault contract
2. **Security Level**: Choose security configuration
3. **Time-Lock**: Assets are locked for a configurable period
4. **Emergency Recovery**: Set up recovery addresses for edge cases
5. **Claim**: After lock period, withdraw to your address
## Features

- Create bounty vaults locked by a secret hash
- Difficulty tiers with different attempt fees
- Every failed attempt adds to the bounty pool
- Winner receives bounty minus a 2% platform fee
- Vaults expire after 30 days; creators can reclaim refunds
- Secrets are hashed locally; only hashes are stored on-chain

## Usage Flow

1. Creator chooses a secret, bounty amount, and difficulty.
2. Creator prepays the bounty directly to the MiniApp contract and creates the vault.
3. Vault is created and a vault ID is shared publicly.
4. Challengers prepay the attempt fee directly to the MiniApp contract and try breaking the vault.
5. Correct secret wins the bounty; expired vaults can be reclaimed by the creator.

## Fees

- Minimum bounty: 1 GAS
- Attempt fees: 0.1 / 0.5 / 1 GAS (Easy / Medium / Hard)
- Platform fee: 2% deducted from payouts and refunds

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
| **Contract** | `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x78fbd57ccfae14fff4b043a82eb491de542d8eb0) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa` |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Current Integration Surface

- direct prepaid GAS to the MiniApp contract
- direct contract invocation only
- Oracle / AA integrations remain external and configurable

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
- direct contract invocation only
- wallet signs the transfer first, then the business call


## License

MIT License - R3E Network
