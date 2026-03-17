# Dev Tipping

Support ecosystem developers with tips

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-dev-tipping` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app)


## How It Works

1. **Connect Wallet**: Developers connect their Neo wallet to receive tips
2. **Share Address**: Share your tipping address or QR code
3. **Receive Tips**: Anyone can send GAS tokens as appreciation
4. **Track Stats**: Tip amounts and frequencies are tracked on-chain
5. **Withdraw Funds**: Developers can withdraw accumulated tips at any time
## Features

- **Direct Tipping**: Send GAS directly to recognized developers
- **Verified Recipients**: All recipients are verified ecosystem contributors
- **Instant Delivery**: Tips are delivered immediately on-chain
- **Transparent History**: All tips are recorded on the blockchain
- **Low Fees**: Minimal transaction costs

## Usage

### Sending a Tip

1. **Connect Wallet**: Link your Neo N3 wallet
2. **Select Developer**: Browse the list of verified developers
3. **Enter Amount**: Choose how much GAS to send (0.01 - 100 GAS)
4. **Add Message** (optional): Include a note of appreciation
5. **Confirm**: Review and sign the transaction
6. **Done**: Your tip is delivered instantly

## Funding Model

- direct prepaid GAS to the MiniApp contract
- no PaymentHub receipt path
- wallet signs the transfer first, then calls `Tip`

### Finding Developers

- **By Project**: Filter by the project the developer works on
- **By Contribution**: See developers ranked by community support
- **By Recent Activity**: Find active contributors

### Best Practices

- Small tips add up - every contribution matters
- Leave encouraging messages for developers
- Support multiple developers working on projects you use

### Tips History

- View all tips you've sent and received
- Export history for accounting purposes
- Share your contribution proof

## Limits

| Limit Type | Value |
|------------|-------|
| Minimum Tip | 0.01 GAS |
| Maximum per Transaction | 100 GAS |
| Daily Limit | 1000 GAS |

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
| **Contract** | `0x93d2406a73e060d43cbe28fb26d863e5ac4744a2` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x93d2406a73e060d43cbe28fb26d863e5ac4744a2) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x1d476b067a180bc54ee4f90c91489ffa123759a4` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x1d476b067a180bc54ee4f90c91489ffa123759a4) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Current Integration Surface

- direct prepaid GAS to the MiniApp contract
- no PaymentHub receipt path
- optional Oracle / AA integrations are external to this repo and configured by environment

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
- **Max per TX**: 100 GAS
- **Daily Cap**: 1000 GAS

## License

MIT License - R3E Network
