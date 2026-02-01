# Coin Flip

50/50 coin flip game with jackpot and achievements

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-coinflip` |
| **Category** | Gaming |
| **Version** | 2.0.0 |
| **Framework** | Vue 3 (uni-app)


## How It Works

1. **Place Bet**: Players bet GAS on either heads or tails
2. **Randomness**: The Neo blockchain provides verifiable randomness via NCG
3. **Outcome Determination**: The result is determined by on-chain randomness
4. **Rewards**: Winners receive payouts based on the odds
5. **House Edge**: A small house edge funds the platform运营
## Features

- **Provably Fair**: TEE VRF randomness ensures transparent outcome
- **Jackpot System**: 1% of bets contribute to jackpot pool
- **Player Statistics**: Track bets, wins, streaks, and spending
- **Achievement System**: 10 unlockable achievements
- **Streak Bonuses**: Win streak bonuses up to 5% extra payout
- **Bet History**: Complete bet history per player

## Usage

### Placing a Bet
1. Connect your Neo wallet
2. Select **Heads** or **Tails**
3. Choose your bet amount (0.1 - 50 GAS)
4. Click **Flip Coin** to place your bet
5. Confirm the transaction in your wallet

### Winning
- Correct guess: Win 2x your bet (minus 3% platform fee)
- Jackpot win: Win the current jackpot pool (0.5% chance)

### Streak Bonuses
| Streak | Bonus |
|--------|-------|
| 3 wins | +1% |
| 5 wins | +3% |
| 10 wins | +5% |

### Tracking Progress
- **Stats Tab**: View your total bets, wins, losses, and profit/loss
- **History Tab**: See detailed history of all your bets
- **Achievements Tab**: Track progress toward unlockable badges

### Responsible Gaming
- Set personal betting limits
- Never bet more than you can afford to lose
- Take breaks between sessions

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
| **Contract** | `0xbd4c9203495048900e34cd9c4618c05994e86cc0` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xbd4c9203495048900e34cd9c4618c05994e86cc0) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1) |
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
- **Min Bet**: 0.1 GAS
- **Max Bet**: 50 GAS
- **Platform Fee**: 3%
- **Jackpot Contribution**: 1% per bet
- **Jackpot Win Chance**: 0.5%

## Contract Methods

### User Methods

#### `PlaceBet(player, amount, choice, receiptId) → betId`

Place a coin flip bet.

| Parameter | Type | Description |
|-----------|------|-------------|
| `player` | Hash160 | Player wallet address |
| `amount` | Integer | Bet amount in GAS (base units, 1e8) |
| `choice` | Boolean | `true` = heads, `false` = tails |
| `receiptId` | Integer | Payment receipt ID from PaymentHub |

**Note**: Amount is validated against the payment receipt.

### Query Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `GetBetDetails` | `betId` | Get bet information |
| `GetPlayerStatsDetails` | `player` | Get player statistics |
| `GetPlatformStats` | - | Get platform statistics |
| `GetUserBets` | `player, offset, limit` | Get player bet history |
| `GetUserBetCount` | `player` | Get total bet count |

## Achievements

| ID | Name | Requirement |
|----|------|-------------|
| 1 | First Win | Win 1 bet |
| 2 | Ten Wins | Win 10 bets |
| 3 | Hundred Wins | Win 100 bets |
| 4 | High Roller | Single bet >= 10 GAS |
| 5 | Lucky Streak | 5 consecutive wins |
| 6 | Jackpot Winner | Win the jackpot |
| 7 | Veteran | Place 100 total bets |
| 8 | Big Spender | Wager 100 GAS total |
| 9 | Comeback King | Win after 5 loss streak |
| 10 | Whale | Single bet >= 50 GAS |

## License

MIT License - R3E Network
