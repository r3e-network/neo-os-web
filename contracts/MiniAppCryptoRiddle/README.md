# MiniAppCryptoRiddle

## What is CryptoRiddle?

CryptoRiddle is a **password-protected red envelope game** on the Neo N3 blockchain. Creators set up riddles with GAS rewards, and players compete to solve them first. The answer is protected by SHA256 hashing, ensuring fairness - even the blockchain cannot see the answer until someone solves it.

**Think of it as:** A treasure hunt where the treasure is GAS, and the map is a riddle only you can solve.

---

## 中文说明

### 什么是 CryptoRiddle？

CryptoRiddle 是一个基于 Neo N3 区块链的**密码红包猜谜游戏**。创建者设置带有 GAS 奖励的谜题，玩家竞相破解。答案通过 SHA256 哈希保护，确保公平性 - 即使区块链也无法在有人解开之前看到答案。

**简单理解：** 这是一场寻宝游戏，宝藏是 GAS，而地图是只有你能解开的谜题。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CRYPTO RIDDLE FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATOR SETS UP RIDDLE                                  │
│     ┌──────────────────────────────────────┐                │
│     │ Hint: "What has keys but no locks?"  │                │
│     │ Answer Hash: SHA256("keyboard")      │                │
│     │ Reward: 5 GAS                        │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  2. PLAYERS ATTEMPT TO SOLVE                                │
│     ┌──────────────────────────────────────┐                │
│     │ Player A: "piano" ❌ (+0.01 to pool) │                │
│     │ Player B: "music" ❌ (+0.01 to pool) │                │
│     │ Player C: "keyboard" ✅ WINNER!      │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  3. WINNER CLAIMS PRIZE                                     │
│     ┌──────────────────────────────────────┐                │
│     │ Original: 5.00 GAS                   │                │
│     │ + Failed attempts: 0.02 GAS          │                │
│     │ = Total Prize: 5.02 GAS              │                │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic               | Description                                   |
| ---------------------- | --------------------------------------------- |
| **Answer Protection**  | SHA256 hash - nobody can see the answer       |
| **Growing Prize Pool** | Each wrong attempt adds 0.01 GAS to the prize |
| **First Solver Wins**  | Only one winner per riddle                    |
| **Permanent Record**   | All attempts recorded on-chain                |

---

## User Guide

### For Riddle Creators

#### Step 1: Prepare Your Riddle

```javascript
// Example: Create a riddle about blockchain
const hint =
  "I am a chain that cannot be broken, yet I hold no links. What am I?";
const answer = "blockchain";
const answerHash = SHA256(answer); // Hash the answer locally
const reward = 1.0; // GAS amount (minimum 0.1 GAS)
```

#### Step 2: Create the Riddle

```javascript
// Call the contract
CreateRiddle(
  creatorAddress, // Your wallet address
  hint, // The riddle hint (max 200 chars)
  answerHash, // SHA256 hash of the answer
  reward, // GAS reward amount
  receiptId, // Payment receipt from PaymentHub
);
// Returns: riddleId (use this to share your riddle)
```

#### Tips for Good Riddles

- **Be creative** - Make it challenging but solvable
- **Be fair** - The answer should be guessable from the hint
- **Be clear** - Avoid ambiguous answers
- **Higher rewards** - Attract more players

### For Riddle Solvers

#### Step 1: Find a Riddle

```javascript
// Get riddle details
const riddle = GetRiddle(riddleId);
console.log(riddle.Hint); // "What has keys but no locks?"
console.log(riddle.Reward); // Current prize pool
console.log(riddle.AttemptCount); // How many have tried
console.log(riddle.Solved); // Is it still available?
```

#### Step 2: Submit Your Answer

```javascript
// Each attempt costs 0.01 GAS
SolveRiddle(
  riddleId, // The riddle to solve
  solverAddress, // Your wallet address
  "keyboard", // Your answer guess
  receiptId, // Payment receipt for attempt fee
);
// Returns: true if correct, false if wrong
```

#### Strategy Tips

- **Read carefully** - The hint contains clues
- **Think laterally** - Answers may be wordplay
- **Check attempt count** - High attempts = harder riddle
- **Calculate ROI** - Is the prize worth the attempt fee?

---

## Technical Reference

### Contract Information

| Property            | Value                  |
| ------------------- | ---------------------- |
| **Contract Name**   | MiniAppCryptoRiddle    |
| **App ID**          | `miniapp-cryptoriddle` |
| **Category**        | Gaming / Puzzle        |
| **Minimum Reward**  | 0.1 GAS                |
| **Attempt Fee**     | 0.01 GAS               |
| **Hash Algorithm**  | SHA256                 |
| **Max Hint Length** | 200 characters         |

### Data Structure

```csharp
struct RiddleData {
    UInt160 Creator;        // Riddle creator's address
    string Hint;            // The riddle hint text
    ByteString AnswerHash;  // SHA256 hash of correct answer
    BigInteger Reward;      // Current prize pool (GAS)
    BigInteger AttemptCount;// Number of attempts made
    bool Solved;            // Whether riddle is solved
    UInt160 Winner;         // Winner's address (if solved)
    BigInteger CreateTime;  // Block timestamp of creation
}
```

### Contract Methods

#### CreateRiddle

Creates a new riddle with GAS reward.

```csharp
BigInteger CreateRiddle(
    UInt160 creator,       // Creator's address
    string hint,           // Riddle hint (max 200 chars)
    ByteString answerHash, // SHA256 hash of answer
    BigInteger reward,     // GAS reward (min 0.1)
    BigInteger receiptId   // Payment receipt ID
)
```

**Returns:** `riddleId` - Unique identifier for the riddle

**Events Emitted:** `RiddleCreated(riddleId, creator, reward)`

#### SolveRiddle

Attempts to solve a riddle.

```csharp
bool SolveRiddle(
    BigInteger riddleId,   // Riddle to solve
    UInt160 solver,        // Solver's address
    string answer,         // Answer attempt
    BigInteger receiptId   // Payment receipt for fee
)
```

**Returns:** `true` if correct, `false` if wrong

**Events Emitted:**

- `AttemptMade(riddleId, solver, correct)` - Always
- `RiddleSolved(riddleId, winner, reward)` - If correct

#### GetRiddle (Safe/Read-only)

Retrieves riddle information.

```csharp
RiddleData GetRiddle(BigInteger riddleId)
```

**Returns:** `RiddleData` struct with all riddle details

### Events

| Event           | Parameters                | Description        |
| --------------- | ------------------------- | ------------------ |
| `RiddleCreated` | riddleId, creator, reward | New riddle created |
| `AttemptMade`   | riddleId, solver, correct | Someone attempted  |
| `RiddleSolved`  | riddleId, winner, reward  | Riddle was solved  |

---

## Use Cases

### Entertainment

- **Party games** - Create riddles for friends
- **Community events** - Host riddle competitions
- **Educational** - Teach crypto concepts through puzzles

### Marketing

- **Promotional campaigns** - Brand awareness through riddles
- **Product launches** - Reveal features through puzzles
- **Community engagement** - Reward active community members

### Gamification

- **Learning platforms** - Quiz rewards
- **Onboarding** - New user tutorials with rewards
- **Loyalty programs** - Exclusive riddles for members

---

## Security Considerations

| Aspect               | Protection                                     |
| -------------------- | ---------------------------------------------- |
| **Answer Privacy**   | SHA256 hash - answer never stored in plaintext |
| **Fair Play**        | On-chain verification - no cheating possible   |
| **Fund Safety**      | Rewards locked until solved                    |
| **Attempt Tracking** | All attempts permanently recorded              |

### Important Notes

- **Answer is case-sensitive** - "Keyboard" ≠ "keyboard"
- **No refunds** - Attempt fees are non-refundable
- **One winner** - First correct answer wins all
- **Permanent** - Riddles cannot be deleted once created

---

## Integration Example

### Frontend Integration

```typescript
import { NeoWallet } from "@neo/wallet";

// Create a riddle
async function createRiddle(hint: string, answer: string, reward: number) {
  const answerHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(answer),
  );

  const receipt = await paymentHub.payGAS(reward);

  return await contract.invoke("CreateRiddle", [
    wallet.address,
    hint,
    answerHash,
    reward * 100000000, // Convert to GAS units
    receipt.id,
  ]);
}

// Solve a riddle
async function solveRiddle(riddleId: number, answer: string) {
  const receipt = await paymentHub.payGAS(0.01);

  return await contract.invoke("SolveRiddle", [
    riddleId,
    wallet.address,
    answer,
    receipt.id,
  ]);
}
```

---

## Version History

| Version | Date    | Changes         |
| ------- | ------- | --------------- |
| 1.0.0   | 2024-12 | Initial release |

---

**Contract**: MiniAppCryptoRiddle
**Author**: R3E Network
**License**: See project root
