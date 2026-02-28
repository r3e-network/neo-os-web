# MiniAppMillionPieceMap

## What is MillionPieceMap?

MillionPieceMap is a **collaborative world map ownership game** on the Neo N3 blockchain. Players can claim, own, and trade pieces of a 100x100 grid map (10,000 total pieces). It's inspired by the famous "Million Dollar Homepage" - but on blockchain with tradeable ownership.

**Think of it as:** Digital real estate on a shared canvas where you can buy land, hold it, or flip it for profit.

---

## 中文说明

### 什么是百万拼图地图？

百万拼图地图是一个基于 Neo N3 区块链的**协作式地图所有权游戏**。玩家可以认领、拥有和交易 100x100 网格地图的碎片（共 10,000 块）。灵感来自著名的"百万美元主页" - 但在区块链上具有可交易的所有权。

**简单理解：** 共享画布上的数字房地产，你可以购买土地、持有或转手获利。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  MILLION PIECE MAP FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CLAIM UNCLAIMED PIECE                                   │
│     ┌──────────────────────────────────────┐                │
│     │  Map Grid (100x100):                 │                │
│     │  ░░░░░░░░░░  (unclaimed = ░)         │                │
│     │  ░░██░░░░░░  Player A claims (2,1)   │                │
│     │  ░░░░░░░░░░  Cost: 0.1 GAS           │                │
│     │  ░░░░░░░░░░                          │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  2. LIST FOR SALE                                           │
│     ┌──────────────────────────────────────┐                │
│     │  Player A lists (2,1) for 0.5 GAS    │                │
│     │  Status: FOR SALE 💰                 │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  3. ANOTHER PLAYER BUYS                                     │
│     ┌──────────────────────────────────────┐                │
│     │  Player B buys (2,1) for 0.5 GAS     │                │
│     │  Ownership transferred: A → B        │                │
│     │  Player A profits: 0.4 GAS           │                │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic        | Value        | Description                   |
| --------------- | ------------ | ----------------------------- |
| **Map Size**    | 100x100      | 10,000 total pieces           |
| **Claim Price** | 0.1 GAS      | Cost to claim unclaimed piece |
| **Trading**     | Free market  | Set any price for your pieces |
| **Coordinates** | (0-99, 0-99) | X and Y position on grid      |

---

## User Guide

### Claiming Pieces

```javascript
// Claim an unclaimed piece at coordinates (x, y)
const x = 50; // Column (0-99)
const y = 25; // Row (0-99)

const receipt = await paymentHub.payGAS(0.1);
await contract.invoke("ClaimPiece", [walletAddress, x, y, receipt.id]);

console.log(`Claimed piece at (${x}, ${y})!`);
```

### Listing for Sale

```javascript
// List your piece for sale
const x = 50;
const y = 25;
const salePrice = 0.5 * 100000000; // 0.5 GAS

await contract.invoke("ListForSale", [x, y, walletAddress, salePrice]);
console.log(`Listed (${x}, ${y}) for 0.5 GAS`);
```

### Buying Listed Pieces

```javascript
// Buy a piece that's listed for sale
const x = 50;
const y = 25;
const price = 0.5; // Listed price

const receipt = await paymentHub.payGAS(price);
await contract.invoke("BuyPiece", [x, y, walletAddress, receipt.id]);
console.log(`Bought piece at (${x}, ${y})!`);
```

### Check Piece Info

```javascript
const piece = await contract.call("GetPiece", [x, y]);

console.log(`Owner: ${piece.Owner}`);
console.log(`Position: (${piece.X}, ${piece.Y})`);
console.log(`Purchase Time: ${piece.PurchaseTime}`);
console.log(`Last Price: ${piece.Price / 100000000} GAS`);
```

---

## Technical Reference

### Contract Information

| Property          | Value                     |
| ----------------- | ------------------------- |
| **Contract Name** | MiniAppMillionPieceMap    |
| **App ID**        | `miniapp-millionpiecemap` |
| **Category**      | Gaming / Collectibles     |
| **Map Size**      | 100x100 (10,000 pieces)   |
| **Piece Price**   | 0.1 GAS (10000000)        |

### Data Structure

```csharp
struct PieceData {
    UInt160 Owner;           // Current owner
    BigInteger X;            // X coordinate (0-99)
    BigInteger Y;            // Y coordinate (0-99)
    BigInteger PurchaseTime; // When last purchased
    BigInteger Price;        // Last purchase price
}
```

### Contract Methods

#### ClaimPiece

Claims an unclaimed piece.

```csharp
void ClaimPiece(
    UInt160 owner,
    BigInteger x,
    BigInteger y,
    BigInteger receiptId
)
```

**Events:** `PieceClaimed(pieceId, owner, x, y)`

#### ListForSale

Lists owned piece for sale.

```csharp
void ListForSale(
    BigInteger x,
    BigInteger y,
    UInt160 owner,
    BigInteger price
)
```

#### BuyPiece

Buys a listed piece.

```csharp
void BuyPiece(
    BigInteger x,
    BigInteger y,
    UInt160 buyer,
    BigInteger receiptId
)
```

**Events:** `PieceTraded(pieceId, from, to, price)`

### Events

| Event          | Parameters               | Description       |
| -------------- | ------------------------ | ----------------- |
| `PieceClaimed` | pieceId, owner, x, y     | New piece claimed |
| `PieceTraded`  | pieceId, from, to, price | Piece sold        |

---

## Security & Fair Play

| Aspect            | Protection                  |
| ----------------- | --------------------------- |
| **Ownership**     | On-chain verified ownership |
| **No Duplicates** | Each coordinate unique      |
| **Fair Trading**  | Buyer pays listed price     |

---

**Contract**: MiniAppMillionPieceMap
**Author**: R3E Network
**Version**: 1.0.0
