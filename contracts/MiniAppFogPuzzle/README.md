# MiniAppFogPuzzle

## What is FogPuzzle?

FogPuzzle is a **hidden treasure hunt game** on the Neo N3 blockchain with fog of war mechanics. A treasure is randomly hidden on a 10x10 grid, and players pay to reveal tiles one by one. The player who finds the treasure wins the entire prize pool, which grows with each reveal attempt.

**Think of it as:** Minesweeper meets treasure hunting - but instead of avoiding mines, you're searching for gold, and every click costs GAS.

---

## 中文说明

### 什么是迷雾拼图？

迷雾拼图是一个基于 Neo N3 区块链的**战争迷雾寻宝游戏**。宝藏随机隐藏在 10x10 的网格中，玩家付费逐个揭示格子。找到宝藏的玩家赢得全部奖池，奖池随着每次揭示尝试而增长。

**简单理解：** 扫雷游戏遇上寻宝 - 但不是避开地雷，而是寻找黄金，每次点击都需要 GAS。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     FOG PUZZLE FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATOR SETS UP PUZZLE                                  │
│     ┌──────────────────────────────────────┐                │
│     │ Initial Prize: 5 GAS                 │                │
│     │ Grid: 10x10 (100 tiles)              │                │
│     │ Treasure: Hidden at random (X,Y)     │                │
│     │ RNG Service generates location       │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  2. PLAYERS REVEAL TILES                                    │
│     ┌──────────────────────────────────────┐                │
│     │  ░░░░░░░░░░  (fog covered)           │                │
│     │  ░░░░░░░░░░                          │                │
│     │  ░░░░██░░░░  Player A reveals (4,2)  │                │
│     │  ░░░░░░░░░░  ❌ No treasure (+0.05)  │                │
│     │  ░░░░░░░░░░                          │                │
│     │  Prize Pool: 5.05 GAS                │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  3. MORE PLAYERS JOIN                                       │
│     ┌──────────────────────────────────────┐                │
│     │  ░░░░░░░░░░                          │                │
│     │  ░░██░░░░░░  Player B: (2,1) ❌      │                │
│     │  ░░░░██░░░░                          │                │
│     │  ░░░░░░██░░  Player C: (6,3) ❌      │                │
│     │  ░░░░░░░░░░                          │                │
│     │  Prize Pool: 5.15 GAS                │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  4. TREASURE FOUND!                                         │
│     ┌──────────────────────────────────────┐                │
│     │  Player D reveals (7,8)              │                │
│     │  🎉 TREASURE FOUND!                  │                │
│     │  💰 Player D wins 5.20 GAS           │                │
│     │  Puzzle marked as SOLVED             │                │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic         | Value     | Description                      |
| ---------------- | --------- | -------------------------------- |
| **Grid Size**    | 10x10     | 100 possible treasure locations  |
| **Reveal Fee**   | 0.05 GAS  | Cost per tile reveal             |
| **Min Prize**    | 1 GAS     | Minimum initial prize pool       |
| **Prize Growth** | +0.05 GAS | Each reveal adds to prize pool   |
| **RNG Service**  | TEE-based | Secure random treasure placement |

---

## User Guide

### For Puzzle Creators

#### Create a New Puzzle

```javascript
const initialPrize = 5; // 5 GAS starting prize

const receipt = await paymentHub.payGAS(initialPrize);
const puzzleId = await contract.invoke("CreatePuzzle", [
  walletAddress,
  initialPrize * 100000000,
  receipt.id,
]);

console.log(`Puzzle #${puzzleId} created!`);
// RNG service will place treasure randomly
```

### For Treasure Hunters

#### Check Puzzle Status

```javascript
const puzzle = await contract.call("GetPuzzle", [puzzleId]);

console.log(`Prize Pool: ${puzzle.Prize / 100000000} GAS`);
console.log(`Reveals Made: ${puzzle.RevealCount}`);
console.log(`Solved: ${puzzle.Solved}`);
```

#### Reveal a Tile

```javascript
const x = 5; // Column (0-9)
const y = 3; // Row (0-9)

const receipt = await paymentHub.payGAS(0.05);
const found = await contract.invoke("RevealTile", [
  puzzleId,
  walletAddress,
  x,
  y,
  receipt.id,
]);

if (found) {
  console.log("🎉 TREASURE FOUND! You win!");
} else {
  console.log("❌ Not here, keep searching...");
}
```

### Strategy Tips

| Strategy            | Description                             |
| ------------------- | --------------------------------------- |
| **Grid Analysis**   | Track revealed tiles to narrow search   |
| **ROI Calculation** | Compare prize pool vs remaining tiles   |
| **Early Entry**     | Fewer reveals = better odds per attempt |
| **Pattern Search**  | Try systematic grid coverage            |

---

## Technical Reference

### Contract Information

| Property          | Value               |
| ----------------- | ------------------- |
| **Contract Name** | MiniAppFogPuzzle    |
| **App ID**        | `miniapp-fogpuzzle` |
| **Category**      | Gaming / Puzzle     |
| **Grid Size**     | 10x10 (100 tiles)   |
| **Reveal Fee**    | 0.05 GAS (5000000)  |
| **Min Prize**     | 1 GAS (100000000)   |

### Data Structure

```csharp
struct FogPuzzleData {
    UInt160 Creator;        // Puzzle creator
    BigInteger Prize;       // Current prize pool
    BigInteger TreasureX;   // Hidden X coordinate (0-9)
    BigInteger TreasureY;   // Hidden Y coordinate (0-9)
    BigInteger RevealCount; // Total tiles revealed
    bool Solved;            // True when found
    UInt160 Winner;         // Winner's address
}
```

### Contract Methods

#### CreatePuzzle

Creates a new fog puzzle with hidden treasure.

```csharp
BigInteger CreatePuzzle(
    UInt160 creator,
    BigInteger prize,
    BigInteger receiptId
)
```

**Returns:** `puzzleId`

**Events:** `PuzzleStarted(puzzleId, creator)`

#### RevealTile

Reveals a tile at specified coordinates.

```csharp
bool RevealTile(
    BigInteger puzzleId,
    UInt160 player,
    BigInteger x,
    BigInteger y,
    BigInteger receiptId
)
```

**Returns:** `true` if treasure found

**Events:**

- `TileRevealed(puzzleId, tileId, hasPrize)`
- `PuzzleSolved(puzzleId, winner, reward)` - if found

### Events

| Event           | Parameters                 | Description      |
| --------------- | -------------------------- | ---------------- |
| `PuzzleStarted` | puzzleId, creator          | New puzzle ready |
| `TileRevealed`  | puzzleId, tileId, hasPrize | Tile uncovered   |
| `PuzzleSolved`  | puzzleId, winner, reward   | Treasure found   |

---

## Security & Fair Play

| Aspect              | Protection                      |
| ------------------- | ------------------------------- |
| **Random Location** | TEE-based RNG service           |
| **Hidden Coords**   | Treasure position never exposed |
| **Growing Prize**   | All fees add to winner's reward |
| **One Winner**      | First finder takes all          |

---

**Contract**: MiniAppFogPuzzle
**Author**: R3E Network
**Version**: 1.0.0
