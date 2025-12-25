# Fog Chess

Chess with Fog of War - TEE-powered hidden piece positions.

## Overview

Fog Chess brings the classic strategy game to Neo N3 with a twist: you can only see enemy pieces within your pieces' line of sight. The TEE ensures fair play by hiding opponent positions until revealed.

## Features

- **Fog of War**: Only see enemies in your pieces' vision range
- **TEE Privacy**: Hidden positions secured in trusted enclave
- **GAS Stakes**: Bet on matches for added excitement
- **Ranked Play**: ELO-based matchmaking system
- **Move History**: Full game replay after match ends

## How It Works

1. **Find Match**: Join queue or challenge a friend
2. **Stake GAS**: Optional betting (0.1-1 GAS)
3. **Play Chess**: Standard rules with fog mechanic
4. **Win Rewards**: Winner takes pot minus 5% fee

## Fog Mechanics

| Piece  | Vision Range                 |
| ------ | ---------------------------- |
| Pawn   | 1 square diagonal forward    |
| Knight | L-shape squares only         |
| Bishop | Diagonal lines until blocked |
| Rook   | Straight lines until blocked |
| Queen  | All directions until blocked |
| King   | Adjacent 8 squares           |

## Technical Details

### Platform Capabilities Used

| Capability   | Usage                   |
| ------------ | ----------------------- |
| **Payments** | GAS staking and payouts |
| **RNG**      | Random side assignment  |
| **Compute**  | TEE fog calculation     |

### Game Flow

```
Match Found → Assign Sides → Play Moves → TEE Validates → Game End
     ↓            ↓             ↓             ↓            ↓
  Stake GAS   VRF random    Send move    Check legal   Payout winner
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "rng": true,
    "compute": true
  },
  "assets_allowed": ["GAS"]
}
```

## Development

```bash
npx serve miniapps/builtin/fog-chess
```

## Related Apps

- [Secret Poker](../secret-poker/) - TEE card games
- [Dice Game](../dice-game/) - Quick betting games
