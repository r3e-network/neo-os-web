# Daily Check-in 每日签到

Daily check-in rewards and streak tracking

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-dailycheckin` |
| **Category** | rewards |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Earn GAS by checking in daily

Check in every day to build your streak. Complete 7 consecutive days to earn 1 GAS, then earn 1.5 GAS for every additional 7 days. Miss a day and your streak resets!


## How It Works

1. **Check In Daily**: Users check in once per UTC day to earn rewards
2. **Streak Bonus**: Consecutive check-ins increase reward multipliers
3. **Milestone Rewards**: Special bonuses are awarded at day 7, 14, 30, and beyond
4. **On-Chain Verification**: All check-ins are recorded and verifiable on Neo
5. **No Gas Fee**: Check-ins are free - platform sponsors the gas costs
## Features

- **UTC Day Reset**: Global countdown to UTC 00:00, same for all users
- **Streak Rewards**: Day 7: 1 GAS, Day 14+: +1.5 GAS every 7 days

## How to use

1. Connect your Neo wallet
2. Check in once per UTC day
3. Build your streak to earn rewards
4. Claim your GAS rewards anytime

## Usage

### Getting Started

1. **Launch the App**: Open Daily Check-in from your Neo MiniApp dashboard
2. **Connect Your Wallet**: Click "Connect Wallet" to link your Neo N3 wallet
3. **Check In**: Click the check-in button to claim your daily reward

### Check-in Mechanics

1. **Daily Check-in**:
   - Click "Check In" to claim your daily reward
   - Check-ins reset at UTC 00:00 (midnight)
   - Only one check-in per UTC day is allowed

2. **Streak Building**:
   - Check in every day to maintain your streak
   - Missing a day resets your streak to 0
   - Consistent check-ins maximize your rewards

3. **Reward Schedule**:
   | Streak Length | Reward per Check-in |
   |---------------|---------------------|
   | Day 1-6 | 0 GAS (build streak) |
   | Day 7 | 1 GAS |
   | Day 8-13 | 0 GAS (build streak) |
   | Day 14+ | 1.5 GAS every 7 days |

### Claiming Rewards

1. **First 7 Days**: Check in daily to unlock your first reward
2. **After Day 7**: Earn 1 GAS per check-in
3. **After Day 14**: Earn 1.5 GAS per check-in
4. **Claim Anytime**: GAS rewards can be claimed at any time

### Maximizing Rewards

- **Consistency is Key**: Check in every UTC day without missing
- **Track Your Streak**: Monitor your current streak in the app
- **Set Reminders**: Use the countdown timer to know when you can check in

### Streak Recovery

**Unfortunately, missed days cannot be recovered.**
- Streak resets to 0 if you miss a day
- Plan your check-ins around your schedule
- Consider time zone differences

### FAQ

**What time does the day reset?**
UTC 00:00 (midnight Coordinated Universal Time).

**Can I check in twice in one day?**
No, only one check-in is allowed per UTC day.

**Do I need to claim rewards separately?**
No, rewards are automatically added to your balance.

**What happens if I miss a day?**
Your streak resets to day 0.

**Can I see my history?**
Check the app for your current streak and reward history.

### Troubleshooting

**Check-in button disabled:**
- You may have already checked in today
- Wait for UTC reset

**Streak showing incorrectly:**
- Refresh the app
- Check if you've missed any days

**Rewards not showing:**
- Check your GAS balance in wallet
- Transaction may still be processing

### Support

For reward questions, refer to the Neo documentation.

For technical issues, contact the Neo MiniApp team.

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- Core interactions are executed on-chain via the app contract.

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x47be6b7caa014c5879ac3eab3b246d5302f9f8cc` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x47be6b7caa014c5879ac3eab3b246d5302f9f8cc) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x908867b23ab551a598723ceeaaedd70c54e10c76` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x908867b23ab551a598723ceeaaedd70c54e10c76) |
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
