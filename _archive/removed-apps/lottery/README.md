# Neo Lottery 福彩中心

Decentralized lottery with provably fair TEE VRF randomness and instant scratch cards

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-lottery` |
| **Category** | Gaming |
| **Version** | 3.0.0 |
| **Framework** | Vue 3 (uni-app) |
| **Theme** | Chinese Lucky (红金色) |


## How It Works

1. **Buy Tickets**: Purchase lottery tickets with GAS
2. **Draw Period**: Wait for the scheduled draw time
3. **Random Selection**: Winning numbers are selected using Neo blockchain randomness
4. **Prize Pool**: A portion of ticket sales forms the prize pool
5. **Claim Rewards**: Winners can claim their prizes after the draw
## Features

### Scheduled Draws (定期开奖)
- **Provably Fair**: TEE VRF randomness ensures transparent winner selection
- **Player Statistics**: Track tickets, wins, spending, and streaks
- **Achievement System**: 6 unlockable achievements for milestones
- **Jackpot Rollover**: Unclaimed prizes roll over to next round
- **Round History**: Complete historical data for all lottery rounds

### Instant Scratch Cards (刮刮乐) 🆕
- **Instant Win**: Scratch and reveal prizes immediately
- **Multiple Types**: 6 lottery types with different price tiers
- **Prize Tiers**: 5 prize levels from 1x to 100x multiplier
- **Canvas Interaction**: Touch-based scratch card experience
- **Win Celebration**: Gold coins and confetti animations

## Usage

### Playing Scheduled Lotteries

1. **Connect Wallet**: Link your Neo N3 wallet
2. **Select Lottery Type**: Choose from 双色球, 快乐8, 七乐彩, 大乐透, 至尊彩
3. **Buy Tickets**: Purchase 1-100 tickets at 0.1 GAS each
4. **Wait for Draw**: Results announced when minimum participants reached
5. **Check Results**: View if your numbers match the winning combination
6. **Claim Winnings**: Winning tickets automatically pay out

### Playing Scratch Cards

1. **Select Scratch Card**: Choose from available instant lottery types
2. **Purchase Ticket**: Buy a scratch card (0.05 - 1 GAS)
3. **Scratch**: Swipe to reveal the prize underneath
4. **Win or Lose**: See instant results with prize multipliers

### Prize Tiers (Scheduled Lottery)

| Match | Prize |
|-------|-------|
| All 5 numbers | 50% of pool |
| 4 numbers | 20% of pool |
| 3 numbers | 15% of pool |
| 2 numbers | 10% of pool |
| 1 number | 5% of pool |

### Responsible Gaming

- Set a budget before playing
- Never chase losses
- Take regular breaks
- Play for entertainment, not as an investment

## Lottery Types 🆕

| ID | Name | Price | Type | Max Prize |
|----|------|-------|------|-----------|
| 0 | 福彩刮刮乐 | 0.05 GAS | Instant | 5 GAS |
| 1 | 双色球 | 0.2 GAS | Scheduled | 100 GAS |
| 2 | 快乐8 | 0.1 GAS | Instant | 10 GAS |
| 3 | 七乐彩 | 0.3 GAS | Scheduled | 200 GAS |
| 4 | 大乐透 | 0.5 GAS | Scheduled | 500 GAS |
| 5 | 至尊彩 | 1 GAS | Scheduled | 1000 GAS |

## Prize Tiers (Scratch Cards) 🆕

| Tier | Odds | Multiplier | Example (0.1 GAS) |
|------|------|------------|-------------------|
| 1 | 10% | 1x | 0.1 GAS |
| 2 | 5% | 2x | 0.2 GAS |
| 3 | 1% | 5x | 0.5 GAS |
| 4 | 0.1% | 20x | 2 GAS |
| 5 | 0.01% | 100x | 10 GAS |

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ✅ Yes |
| Data Feed | ❌ No |
| Governance | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x3e330b4c396b40aa08d49912c0179319831b3a6e` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x3e330b4c396b40aa08d49912c0179319831b3a6e) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xb3c0ca9950885c5bf4d0556e84bc367473c3475e` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xb3c0ca9950885c5bf4d0556e84bc367473c3475e) |
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
- **Ticket Price**: 0.1 GAS
- **Max Tickets per TX**: 100
- **Min Participants**: 3
- **Prize Distribution**: 90% to winner, 10% platform fee

## Contract Methods

### User Methods

#### `BuyTickets(player, ticketCount, receiptId)`

Purchase lottery tickets for the current round.

| Parameter | Type | Description |
|-----------|------|-------------|
| `player` | Hash160 | Player wallet address |
| `ticketCount` | Integer | Number of tickets (1-100) |
| `receiptId` | Integer | Payment receipt ID from PaymentHub |

**Note**: Total cost is calculated as `ticketCount × 0.1 GAS`.

### Scratch Card Methods 🆕

#### `BuyScratchTicket(player, lotteryType, receiptId)`

Purchase an instant scratch ticket.

| Parameter | Type | Description |
|-----------|------|-------------|
| `player` | Hash160 | Player wallet address |
| `lotteryType` | Integer | Lottery type ID (0-5) |
| `receiptId` | Integer | Payment receipt ID |

#### `RevealScratchTicket(player, ticketId)`

Reveal/scratch a ticket to see the prize.

| Parameter | Type | Description |
|-----------|------|-------------|
| `player` | Hash160 | Player wallet address |
| `ticketId` | Integer | Ticket ID from purchase |

**Returns**: `{ ticketId, lotteryType, isWinner, prize, purchaseTime }`

### Query Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `GetCurrentRoundInfo` | - | Get current round status |
| `GetPlayerStatsDetails` | `player` | Get player statistics |
| `GetPlatformStats` | - | Get platform statistics |
| `GetRoundDetails` | `roundId` | Get round history |
| `GetLotteryTypes` | - | Get all lottery type configs 🆕 |
| `GetTypeConfig` | `lotteryType` | Get specific type config 🆕 |
| `GetPlayerScratchTickets` | `player` | Get player's scratch tickets 🆕 |

## Achievements

| ID | Name | Requirement |
|----|------|-------------|
| 1 | First Ticket | Purchase 1 ticket |
| 2 | Ten Tickets | Purchase 10 tickets total |
| 3 | Hundred Tickets | Purchase 100 tickets total |
| 4 | First Win | Win 1 lottery |
| 5 | Big Winner | Win 10+ GAS in single draw |
| 6 | Lucky Streak | Win 3 consecutive rounds |

## License

MIT License - R3E Network
