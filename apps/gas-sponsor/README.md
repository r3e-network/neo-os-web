# Gas Sponsor Gas 代付

Free gas sponsorship for new users with low balance

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-gas-sponsor` |
| **Category** | Utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Free GAS for new users to start transacting

Gas Sponsor provides free GAS to new Neo users with low balances. Request up to 0.1 GAS daily to cover transaction fees and get started on the Neo network.


## How It Works

1. **Sponsorship Pool**: Sponsors deposit GAS into a sponsorship pool
2. **Eligibility Check**: Users are checked against eligibility criteria
3. **Quota System**: Daily quotas ensure fair distribution of sponsored gas
4. **Gasless Transactions**: Eligible users can execute transactions without paying gas
5. **Settlement**: Sponsors settle their pool periodically
## Features

- **Daily Quota**: Request up to 0.1 GAS per day when your balance is low.
- **Auto-Reset**: Quota resets daily at midnight UTC for continued access.

## How to use

1. New users with less than 0.1 GAS are eligible
2. Request up to 0.1 GAS per day for free
3. Use sponsored gas to pay transaction fees
4. Once you have enough GAS, help others!

## Usage

### Getting Started

1. **Launch the App**: Open Gas Sponsor from your Neo MiniApp dashboard
2. **Connect Wallet**: Click "Connect Wallet" to link your Neo N3 wallet
3. **Check Eligibility**: App automatically checks your GAS balance
4. **Request GAS**: If eligible, request your free GAS

### Eligibility Requirements

To receive sponsored GAS, you must meet these criteria:

| Requirement | Details |
|-------------|---------|
| **Balance Threshold** | Less than 0.1 GAS |
| **Daily Limit** | Up to 0.1 GAS per day |
| **Reset Time** | UTC 00:00 (midnight) |

### Requesting GAS

1. **Check Status**:
   - View your current GAS balance
   - See if you're eligible for sponsorship
   - Check your remaining daily quota

2. **Submit Request**:
   - Click "Request GAS" or similar button
   - Confirm the transaction (no cost to you)
   - Receive up to 0.1 GAS instantly

3. **Use Sponsored GAS**:
   - Use the sponsored GAS for any Neo transaction
   - Pay for smart contract interactions
   - Cover network fees for transfers

### Daily Quota System

- **Daily Limit**: 0.1 GAS maximum per UTC day
- **Auto-Reset**: Quota resets at UTC 00:00
- **First Come First Serve**: Available to all eligible users

### Becoming a Sponsor

Once you have sufficient GAS (more than 0.1 GAS):

- You can help sponsor other new users
- Consider paying it forward to help the community
- Build reputation as a community supporter

### Best Practices

- **Save for Important Transactions**: Use sponsored GAS wisely
- **Track Your Balance**: Monitor your GAS level
- **Don't Hoard**: Request only what you need

### FAQ

**How much GAS can I request?**
Up to 0.1 GAS per day when your balance is low.

**Is there any cost?**
No, sponsored GAS is free.

**How often can I request?**
Once per UTC day.

**What if I'm not eligible?**
You have more than 0.1 GAS - you're doing well!

**Can I send GAS to others?**
Yes, you can use your GAS to help others.

### Troubleshooting

**Request button disabled:**
- You may have already requested today
- Check your balance exceeds if 0.1 GAS
- Wait for UTC reset

**Transaction failed:**
- Try again in a few moments
- Check network connectivity
- Ensure wallet is connected

**Balance not updating:**
- Refresh the app
- Check your wallet balance
- Wait for block confirmation

### Support

For sponsorship questions, refer to Neo documentation.

For technical issues, contact the Neo MiniApp team.

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- Validates payments on-chain (PaymentHub receipts when enabled).

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0xae47f11a368ceb778839e80e3ad0ecb952e9c058` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xae47f11a368ceb778839e80e3ad0ecb952e9c058) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x80ea8435a88334b9b80077220097d88c440615f1` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x80ea8435a88334b9b80077220097d88c440615f1) |
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

## Assets

- **Allowed Assets**: GAS

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
