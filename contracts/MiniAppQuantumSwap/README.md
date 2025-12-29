# MiniAppQuantumSwap

## What is QuantumSwap?

QuantumSwap is a **blind box exchange game** on the Neo N3 blockchain inspired by quantum mechanics. Players deposit GAS into sealed "quantum boxes" with hidden values, then randomly swap boxes with other players. Like Schrödinger's cat, the value inside your box remains unknown until you "observe" (reveal) it.

**Think of it as:** A gift exchange party where everyone wraps their gifts, shuffles them randomly, and nobody knows what they'll get until they open their new package.

---

## 中文说明

### 什么是量子交换？

量子交换是一个基于 Neo N3 区块链的**盲盒交换游戏**，灵感来自量子力学。玩家将 GAS 存入密封的"量子盒子"中，然后与其他玩家随机交换盒子。就像薛定谔的猫一样，盒子里的价值在你"观测"（揭示）之前是未知的。

**简单理解：** 这是一场礼物交换派对 - 每个人包装好礼物，随机打乱，直到打开新包裹才知道里面是什么。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    QUANTUM SWAP FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATE SEALED BOX                                       │
│     ┌──────────────────────────────────────┐                │
│     │ Player A deposits 5 GAS              │                │
│     │ 📦 Box #1: [? GAS] (sealed)          │                │
│     │ Added to pending swap pool           │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  2. ANOTHER PLAYER CREATES BOX                              │
│     ┌──────────────────────────────────────┐                │
│     │ Player B deposits 2 GAS              │                │
│     │ 📦 Box #2: [? GAS] (sealed)          │                │
│     │ Added to pending swap pool           │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  3. REQUEST SWAP (Player A)                                 │
│     ┌──────────────────────────────────────┐                │
│     │ System finds random partner          │                │
│     │ Box #1 ←→ Box #2 (values swapped)    │                │
│     │ 📦 Box #1: now contains 2 GAS        │                │
│     │ 📦 Box #2: now contains 5 GAS        │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  4. REVEAL BOX                                              │
│     ┌──────────────────────────────────────┐                │
│     │ Player A reveals Box #1              │                │
│     │ 😢 Got 2 GAS (lost 3 GAS)            │                │
│     │                                      │                │
│     │ Player B reveals Box #2              │                │
│     │ 🎉 Got 5 GAS (gained 3 GAS)          │                │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic        | Value           | Description                      |
| --------------- | --------------- | -------------------------------- |
| **Min Deposit** | 0.1 GAS         | Minimum amount per box           |
| **Max Deposit** | 100 GAS         | Maximum amount per box           |
| **Box States**  | Sealed/Revealed | Value hidden until revealed      |
| **Swap Pool**   | Automatic       | Boxes matched randomly from pool |
| **Ownership**   | Transferable    | Box ownership changes on swap    |

### Box Lifecycle

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐
│ Created │───▶│ Pending │───▶│ Swapped  │───▶│ Revealed │
│ (Sealed)│    │ (Pool)  │    │ (Sealed) │    │ (Open)   │
└─────────┘    └─────────┘    └──────────┘    └──────────┘
     │              │              │               │
     │              │              │               │
   Value         Waiting       New value       Claim GAS
   hidden        for match     assigned        to wallet
```

---

## User Guide

### For Players

#### Step 1: Create a Quantum Box

```javascript
// Deposit GAS into a sealed box (0.1 - 100 GAS)
const depositAmount = 5; // 5 GAS

const receipt = await paymentHub.payGAS(depositAmount);
const boxId = await contract.invoke("CreateBox", [
  walletAddress,
  depositAmount * 100000000, // Convert to GAS units
  receipt.id,
]);

console.log(`Created Box #${boxId} with ${depositAmount} GAS`);
// Your box is now in the pending swap pool
```

#### Step 2: Request a Swap

```javascript
// Request random swap with another box
await contract.invoke("RequestSwap", [boxId, walletAddress]);

// If a partner is found, swap happens automatically
// Your box now contains a different (unknown) amount
```

#### Step 3: Check Box Status

```javascript
const box = await contract.call("GetBox", [boxId]);

console.log(`Owner: ${box.Owner}`);
console.log(`Sealed: ${box.Sealed}`);
console.log(`Swapped: ${box.Swapped}`);
console.log(`Swapped With: Box #${box.SwappedWith}`);

// Note: box.Value is hidden until revealed!
```

#### Step 4: Reveal Your Box

```javascript
// Only after swap is complete
const actualValue = await contract.invoke("RevealBox", [boxId, walletAddress]);

console.log(`🎁 Your box contained: ${actualValue / 100000000} GAS`);
// Now you can see if you won or lost!
```

### Strategy Tips

| Strategy           | Description                                      |
| ------------------ | ------------------------------------------------ |
| **High Risk**      | Deposit max (100 GAS) for bigger potential gains |
| **Low Risk**       | Deposit min (0.1 GAS) to minimize losses         |
| **Timing**         | Swap when pool has many boxes for better odds    |
| **Expected Value** | On average, you break even (minus any fees)      |

---

## Technical Reference

### Contract Information

| Property          | Value                 |
| ----------------- | --------------------- |
| **Contract Name** | MiniAppQuantumSwap    |
| **App ID**        | `miniapp-quantumswap` |
| **Category**      | Gaming / Gambling     |
| **Min Deposit**   | 0.1 GAS (10000000)    |
| **Max Deposit**   | 100 GAS (10000000000) |

### Data Structure

```csharp
struct BoxData {
    UInt160 Owner;           // Current box owner
    BigInteger Value;        // GAS amount (hidden until revealed)
    bool Sealed;             // True = value hidden
    bool Swapped;            // True = swap completed
    BigInteger SwappedWith;  // Partner box ID
    BigInteger CreateTime;   // Block timestamp
}
```

### Contract Methods

#### CreateBox

Creates a new sealed quantum box.

```csharp
BigInteger CreateBox(
    UInt160 creator,      // Creator's address
    BigInteger amount,    // GAS deposit (0.1-100)
    BigInteger receiptId  // Payment receipt ID
)
```

**Returns:** `boxId` - Unique identifier for the box

**Events:** `BoxCreated(boxId, creator, value)`

#### RequestSwap

Requests random swap with another pending box.

```csharp
void RequestSwap(
    BigInteger boxId,     // Your box ID
    UInt160 requester     // Your address
)
```

**Events:** `BoxSwapped(boxId1, boxId2, user1, user2)` - If match found

#### RevealBox

Reveals box contents after swap.

```csharp
BigInteger RevealBox(
    BigInteger boxId,     // Box to reveal
    UInt160 owner         // Box owner
)
```

**Returns:** Actual GAS value in the box

**Events:** `BoxRevealed(boxId, owner, actualValue)`

#### GetBox (Safe/Read-only)

Retrieves box information.

```csharp
BoxData GetBox(BigInteger boxId)
```

### Events

| Event         | Parameters                   | Description           |
| ------------- | ---------------------------- | --------------------- |
| `BoxCreated`  | boxId, creator, value        | New box created       |
| `BoxSwapped`  | boxId1, boxId2, user1, user2 | Two boxes swapped     |
| `BoxRevealed` | boxId, owner, actualValue    | Box contents revealed |

---

## Use Cases

### Entertainment

- **Party games** - Group blind box exchanges
- **Community events** - Random GAS redistribution
- **Gambling alternative** - Pure chance-based game

### Social

- **Gift exchanges** - Anonymous value swapping
- **Icebreakers** - Fun way to redistribute tokens
- **Charity events** - Random donation matching

---

## Security & Fair Play

| Aspect              | Protection                            |
| ------------------- | ------------------------------------- |
| **Hidden Values**   | Values sealed until explicit reveal   |
| **Random Matching** | Time-based seed for partner selection |
| **No Peeking**      | Cannot see box value before swap      |
| **Atomic Swaps**    | Both boxes swap simultaneously        |

### Important Notes

- **No refunds** - Once deposited, GAS is locked until reveal
- **Random outcomes** - You may gain or lose GAS
- **Must swap first** - Cannot reveal without completing swap
- **One reveal** - Box can only be revealed once

---

**Contract**: MiniAppQuantumSwap
**Author**: R3E Network
**Version**: 1.0.0
