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

- The request path currently uses the platform sponsorship API exposed by the wallet SDK.
- Donate / send actions are normal wallet-signed transfers.
- The current runtime uses direct contract invocation only.

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x31888679572bf2de61462ff9934b6265d60284f2` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x31888679572bf2de61462ff9934b6265d60284f2) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x80ea8435a88334b9b80077220097d88c440615f1` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x80ea8435a88334b9b80077220097d88c440615f1) |
| **Network Magic** | `860833102` |

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
