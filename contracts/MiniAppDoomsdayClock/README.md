# MiniAppDoomsdayClock

## What is Doomsday Clock?

Doomsday Clock is a **FOMO3D-style game** on Neo N3 blockchain. A countdown timer ticks toward zero - buy keys to reset it and become the last buyer. When the clock finally hits zero, the last person to buy a key wins the entire pot.

**Think of it as:** Musical chairs with money - when the music stops, the last one standing wins everything.

---

## 中文说明

### 什么是末日时钟？

末日时钟是一个基于 Neo N3 区块链的 **FOMO3D 风格游戏**。倒计时不断归零 - 购买钥匙可以重置计时器并成为最后买家。当时钟最终归零时，最后购买钥匙的人赢得全部奖池。

**简单理解：** 抢椅子游戏的金融版 - 音乐停止时，最后站着的人赢得一切。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────┐
│                  DOOMSDAY CLOCK FLOW                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ROUND STARTS: 1 hour countdown                         │
│  ┌───────────────────────────────────────┐              │
│  │ ⏰ Timer: 60:00                        │              │
│  │ 💰 Pot: 0 GAS                          │              │
│  │ 👤 Last Buyer: None                    │              │
│  └───────────────────────────────────────┘              │
│                      │                                  │
│                      ▼                                  │
│  PLAYER A BUYS 2 KEYS (2 GAS)                          │
│  ┌───────────────────────────────────────┐              │
│  │ ⏰ Timer: 60:00 + 60s = 61:00          │              │
│  │ 💰 Pot: 1.9 GAS (95%)                  │              │
│  │ 👤 Last Buyer: Player A                │              │
│  └───────────────────────────────────────┘              │
│                      │                                  │
│                      ▼                                  │
│  PLAYER B BUYS 1 KEY (1 GAS) at 30:00 left             │
│  ┌───────────────────────────────────────┐              │
│  │ ⏰ Timer: 30:00 + 30s = 30:30          │              │
│  │ 💰 Pot: 2.85 GAS                       │              │
│  │ 👤 Last Buyer: Player B ← NEW LEADER   │              │
│  └───────────────────────────────────────┘              │
│                      │                                  │
│                      ▼                                  │
│  TIMER REACHES ZERO - GAME OVER!                       │
│  ┌───────────────────────────────────────┐              │
│  │ 🏆 WINNER: Player B                    │              │
│  │ 💰 Prize: 2.85 GAS                     │              │
│  └───────────────────────────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic          | Value       | Description          |
| ----------------- | ----------- | -------------------- |
| **Key Price**     | 1 GAS       | Fixed price per key  |
| **Time Added**    | +30 seconds | Per key purchased    |
| **Initial Timer** | 1 hour      | Starting countdown   |
| **Max Timer**     | 24 hours    | Cannot exceed this   |
| **Winner Share**  | 95%         | Of total pot         |
| **Platform Fee**  | 5%          | Retained by platform |

---

## User Guide

### For Players

#### Check Game Status

```javascript
const round = await contract.call("CurrentRound");
const pot = await contract.call("CurrentPot");
const endTime = await contract.call("EndTime");
const lastBuyer = await contract.call("LastBuyer");
const isActive = await contract.call("IsRoundActive");

const timeLeft = endTime - Math.floor(Date.now() / 1000);
console.log(`Round ${round}: ${pot} GAS pot, ${timeLeft}s left`);
console.log(`Current leader: ${lastBuyer}`);
```

#### Buy Keys

```javascript
const keyCount = 3; // Buy 3 keys
const cost = keyCount * 1; // 3 GAS

const receipt = await paymentHub.payGAS(cost);
await contract.invoke("BuyKeys", [walletAddress, keyCount, receipt.id]);
// Timer extended by 90 seconds (3 × 30s)
// You are now the last buyer!
```

### Strategy Tips

- **Watch the timer** - Buy when it's low for maximum pressure
- **Calculate ROI** - Is the pot worth your key investment?
- **Mind the max** - Timer caps at 24 hours
- **Late game** - More intense as pot grows

---

## Technical Reference

### Contract Information

| Property             | Value                    |
| -------------------- | ------------------------ |
| **Contract Name**    | MiniAppDoomsdayClock     |
| **App ID**           | `miniapp-doomsday-clock` |
| **Category**         | Gaming / FOMO            |
| **Key Price**        | 1 GAS                    |
| **Time Per Key**     | 30 seconds               |
| **Initial Duration** | 3600 seconds (1 hour)    |
| **Max Duration**     | 86400 seconds (24 hours) |
| **Platform Fee**     | 5%                       |

### Contract Methods

#### BuyKeys

```csharp
void BuyKeys(UInt160 player, BigInteger keyCount, BigInteger receiptId)
```

Purchase keys to extend timer and become last buyer.

#### ClaimPrize

```csharp
void ClaimPrize()
```

Claim prize when timer expires (only last buyer can call).

#### StartRound (Admin)

```csharp
void StartRound()
```

Start a new game round.

### Events

| Event            | Parameters                    | Description     |
| ---------------- | ----------------------------- | --------------- |
| `KeysPurchased`  | player, keys, potContribution | Keys bought     |
| `DoomsdayWinner` | winner, prize, roundId        | Game ended      |
| `RoundStarted`   | roundId, endTime              | New round began |

---

## Security & Fair Play

- **On-chain timer** - Cannot be manipulated
- **Transparent pot** - Anyone can verify
- **Automatic winner** - No admin intervention needed
- **Anti-whale** - Time cap prevents infinite extension

---

**Contract**: MiniAppDoomsdayClock
**Author**: R3E Network
**Version**: 1.0.0

## English

### Features

- Buy keys to reset countdown (1 GAS per key)
- Each key adds 30 seconds
- Last buyer when timer expires wins
- 5% platform fee, 95% to pot

### Usage

1. Admin starts new round
2. Players buy keys to extend countdown
3. Game ends when timer reaches zero
4. Last buyer wins entire pot

## Technical

- **Contract**: MiniAppDoomsdayClock
- **Category**: Gaming / FOMO
- **Permissions**: Gateway integration
- **Assets**: GAS
- **Key Price**: 1 GAS
- **Time Per Key**: 30 seconds
- **Initial Duration**: 1 hour
- **Max Duration**: 24 hours
- **Platform Fee**: 5%
