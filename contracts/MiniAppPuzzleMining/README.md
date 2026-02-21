# MiniAppPuzzleMining

## What is PuzzleMining?

PuzzleMining is a **collaborative puzzle completion game** on the Neo N3 blockchain. Players "mine" puzzle pieces by paying small fees, and the player who mines the final piece (9th piece) wins the entire prize pool. It combines the excitement of mining with puzzle completion mechanics.

**Think of it as:** A race to complete a jigsaw puzzle where each piece costs a small fee, and whoever places the last piece wins everything.

---

## 中文说明

### 什么是拼图挖矿？

拼图挖矿是一个基于 Neo N3 区块链的**协作式拼图完成游戏**。玩家通过支付小额费用来"挖掘"拼图碎片，挖到最后一块（第9块）的玩家赢得全部奖池。它将挖矿的刺激与拼图完成机制相结合。

**简单理解：** 一场完成拼图的竞赛，每块碎片需要小额费用，放下最后一块的人赢得一切。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PUZZLE MINING FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATOR STARTS PUZZLE                                   │
│     ┌──────────────────────────────────────┐                │
│     │ Prize Pool: 5 GAS                    │                │
│     │ Pieces Required: 9                   │                │
│     │ Pieces Mined: 0/9                    │                │
│     │ ┌───┬───┬───┐                        │                │
│     │ │ ? │ ? │ ? │                        │                │
│     │ ├───┼───┼───┤                        │                │
│     │ │ ? │ ? │ ? │                        │                │
│     │ ├───┼───┼───┤                        │                │
│     │ │ ? │ ? │ ? │                        │                │
│     │ └───┴───┴───┘                        │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  2. PLAYERS MINE PIECES                                     │
│     ┌──────────────────────────────────────┐                │
│     │ Player A mines piece #1 (0.05 GAS)   │                │
│     │ Player B mines piece #2 (0.05 GAS)   │                │
│     │ Player A mines piece #3 (0.05 GAS)   │                │
│     │ ...                                  │                │
│     │ ┌───┬───┬───┐                        │                │
│     │ │ A │ B │ A │  Pieces: 8/9           │                │
│     │ ├───┼───┼───┤                        │                │
│     │ │ C │ A │ B │                        │                │
│     │ ├───┼───┼───┤                        │                │
│     │ │ B │ C │ ? │  ← Last piece!         │                │
│     │ └───┴───┴───┘                        │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  3. FINAL PIECE MINED - WINNER!                             │
│     ┌──────────────────────────────────────┐                │
│     │ Player C mines piece #9              │                │
│     │ 🏆 Player C WINS 5 GAS!              │                │
│     │ Puzzle marked COMPLETED              │                │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic          | Value      | Description                |
| ----------------- | ---------- | -------------------------- |
| **Pieces/Puzzle** | 9          | Total pieces to complete   |
| **Mining Fee**    | 0.05 GAS   | Cost per piece mined       |
| **Min Prize**     | 1 GAS      | Minimum initial prize pool |
| **Winner**        | Last miner | Player who mines 9th piece |

---

## User Guide

### For Puzzle Creators

```javascript
const prizePool = 5; // 5 GAS prize

const receipt = await paymentHub.payGAS(prizePool);
const puzzleId = await contract.invoke("CreatePuzzle", [
  walletAddress,
  prizePool * 100000000,
  receipt.id,
]);

console.log(`Puzzle #${puzzleId} created with ${prizePool} GAS prize!`);
```

### For Miners

#### Check Puzzle Status

```javascript
const puzzle = await contract.call("GetPuzzle", [puzzleId]);

console.log(`Prize: ${puzzle.Reward / 100000000} GAS`);
console.log(`Progress: ${puzzle.PiecesMined}/9 pieces`);
console.log(`Completed: ${puzzle.Completed}`);
```

#### Mine a Piece

```javascript
const receipt = await paymentHub.payGAS(0.05);
await contract.invoke("MinePiece", [puzzleId, walletAddress, receipt.id]);

console.log("Piece mined!");
// If you mined the 9th piece, you win!
```

### Strategy Tips

| Strategy        | Description                        |
| --------------- | ---------------------------------- |
| **Timing**      | Mine when puzzle is at 8/9 pieces  |
| **ROI**         | Compare prize vs total mining cost |
| **Competition** | Watch for other miners' activity   |

---

## Technical Reference

### Contract Information

| Property          | Value                  |
| ----------------- | ---------------------- |
| **Contract Name** | MiniAppPuzzleMining    |
| **App ID**        | `miniapp-puzzlemining` |
| **Category**      | Gaming / Collaborative |
| **Pieces/Puzzle** | 9                      |
| **Mining Fee**    | 0.05 GAS (5000000)     |
| **Min Prize**     | 1 GAS (100000000)      |

### Data Structure

```csharp
struct PuzzleData {
    UInt160 Creator;        // Puzzle creator
    BigInteger Reward;      // Prize pool
    BigInteger PiecesMined; // Current progress (0-9)
    bool Completed;         // True when finished
    UInt160 Winner;         // Winner's address
}
```

### Contract Methods

#### CreatePuzzle

```csharp
BigInteger CreatePuzzle(
    UInt160 creator,
    BigInteger reward,
    BigInteger receiptId
)
```

**Events:** `PuzzleCreated(puzzleId, creator, reward)`

#### MinePiece

```csharp
void MinePiece(
    BigInteger puzzleId,
    UInt160 miner,
    BigInteger receiptId
)
```

**Events:**

- `PieceMined(puzzleId, miner, pieceId)`
- `PuzzleCompleted(puzzleId, winner, reward)` - if 9th piece

### Events

| Event             | Parameters                | Description     |
| ----------------- | ------------------------- | --------------- |
| `PuzzleCreated`   | puzzleId, creator, reward | New puzzle      |
| `PieceMined`      | puzzleId, miner, pieceId  | Piece mined     |
| `PuzzleCompleted` | puzzleId, winner, reward  | Puzzle finished |

---

## Security & Fair Play

| Aspect             | Protection                    |
| ------------------ | ----------------------------- |
| **Fair Mining**    | First-come-first-served       |
| **Piece Tracking** | All ownership recorded        |
| **Prize Lock**     | Funds locked until completion |

---

**Contract**: MiniAppPuzzleMining
**Author**: R3E Network
**Version**: 1.0.0
