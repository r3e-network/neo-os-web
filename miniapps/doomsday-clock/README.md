# Doomsday Clock

FOMO3D style - last buyer wins the pot

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-doomsday-clock` |
| **Category** | security |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Fomo
- Timer
- Jackpot

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
| **Contract** | `0xe4f386057d6308b83a5fd2e84bc3eb9149adc719` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xe4f386057d6308b83a5fd2e84bc3eb9149adc719) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x8f46753fd7123bd276d77ef1100839004b9a3440` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x8f46753fd7123bd276d77ef1100839004b9a3440) |
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

- **Allowed Assets**: GAS

## Contract Methods

### Query Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `GetGameStatus` | - | Get current round status (roundId, pot, active, lastBuyer, remainingTime) |
| `GetPlayerKeys` | `player, roundId` | Get player's key count for a round |
| `GetRoundDetails` | `roundId` | Get detailed round information |

### User Methods

#### `BuyKeys(player, keyCount, receiptId)`

Purchase keys for the current round.

| Parameter | Type | Description |
|-----------|------|-------------|
| `player` | Hash160 | Player wallet address |
| `keyCount` | Integer | Number of keys to buy |
| `receiptId` | Integer | Payment receipt ID from PaymentHub |

## Usage

### Playing the Game

1. **Connect Wallet**: Link your Neo N3 wallet to participate
2. **View Timer**: Check the countdown timer showing time until doomsday
3. **Buy Keys**: Purchase keys to extend the timer and increase your chance to win
4. **Extend Timer**: Each key purchase adds time to the countdown
5. **Win the Pot**: Be the last buyer when the timer hits zero to win the entire jackpot

### Game Strategy

- Keys become more expensive as the pot grows
- Buying multiple keys increases your chance of winning
- Watch for the final moments when other players might hesitate
- The jackpot includes all GAS contributed by key buyers

## How It Works

Doomsday Clock implements a FOMO3D-style game mechanism:

1. **Countdown Timer**: A timer counts down to "doomsday" - when the game ends
2. **Key Purchases**: Players buy keys using GAS to extend the timer
3. **Price Escalation**: Key prices increase as the jackpot grows
4. **Winner Takes All**: The last player to buy a key before the timer expires wins
5. **Pot Distribution**: The entire jackpot goes to the winner, minus platform fees
6. **Round System**: After each round ends, a new round begins with fresh timer

## License

MIT License - R3E Network
