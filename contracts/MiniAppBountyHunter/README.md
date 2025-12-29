# MiniAppBountyHunter

## What is BountyHunter?

BountyHunter is an **on-chain task marketplace** on the Neo N3 blockchain. Creators post bounties with GAS rewards for specific tasks, and hunters compete to complete them first. When a hunter submits valid proof of completion, the creator reviews and approves it, releasing the locked reward.

**Think of it as:** A decentralized freelance platform where tasks are posted with guaranteed payment locked in smart contracts.

---

## 中文说明

### 什么是赏金猎人？

赏金猎人是一个基于 Neo N3 区块链的**链上任务悬赏市场**。创建者发布带有 GAS 奖励的任务悬赏，猎人们竞相完成任务。当猎人提交有效的完成证明后，创建者审核并批准，释放锁定的奖励。

**简单理解：** 这是一个去中心化的自由职业平台，任务发布时奖励已锁定在智能合约中，确保支付安全。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    BOUNTY HUNTER FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATOR POSTS BOUNTY                                    │
│     ┌──────────────────────────────────────┐                │
│     │ Task: "Find bug in smart contract"   │                │
│     │ Reward: 10 GAS (locked)              │                │
│     │ Deadline: 7 days                     │                │
│     │ Status: ACTIVE                       │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  2. HUNTERS SUBMIT CLAIMS                                   │
│     ┌──────────────────────────────────────┐                │
│     │ Hunter A: "Found overflow at line 42"│                │
│     │ Hunter B: "Reentrancy in withdraw()" │                │
│     │ Hunter C: "Access control missing"   │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  3. CREATOR REVIEWS SUBMISSIONS                             │
│     ┌──────────────────────────────────────┐                │
│     │ Creator examines all proofs          │                │
│     │ Selects best/first valid submission  │                │
│     │ Approves Hunter B's claim ✅          │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  4. REWARD DISTRIBUTED                                      │
│     ┌──────────────────────────────────────┐                │
│     │ 🏆 Hunter B receives 10 GAS          │                │
│     │ Bounty marked as COMPLETED           │                │
│     │ Other hunters can try other bounties │                │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic             | Value        | Description                         |
| -------------------- | ------------ | ----------------------------------- |
| **Min Bounty**       | 1 GAS        | Minimum reward per bounty           |
| **Max Description**  | 500 chars    | Task description length limit       |
| **Deadline**         | Configurable | Days until bounty expires           |
| **Proof Storage**    | On-chain     | All submissions permanently stored  |
| **Winner Selection** | Creator      | Creator approves winning submission |

### Bounty Lifecycle

```
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐
│ Created  │───▶│  Active  │───▶│ Claimed   │───▶│ Completed │
│ (Locked) │    │ (Open)   │    │ (Review)  │    │ (Paid)    │
└──────────┘    └──────────┘    └───────────┘    └───────────┘
     │               │               │                │
     │               │               │                │
   Reward         Hunters        Creator           Winner
   locked         submit         reviews           paid
```

---

## User Guide

### For Bounty Creators

#### Step 1: Create a Bounty

```javascript
// Define your bounty
const description =
  "Find and report any security vulnerability in our DeFi contract";
const reward = 10; // 10 GAS
const deadlineDays = 7; // 7 days to complete

// Lock reward and create bounty
const receipt = await paymentHub.payGAS(reward);
const bountyId = await contract.invoke("CreateBounty", [
  walletAddress,
  description,
  reward * 100000000, // Convert to GAS units
  deadlineDays,
  receipt.id,
]);

console.log(`Bounty #${bountyId} created with ${reward} GAS reward`);
```

#### Step 2: Review Submissions

```javascript
// Check bounty status
const bounty = await contract.call("GetBounty", [bountyId]);
console.log(`Description: ${bounty.Description}`);
console.log(`Reward: ${bounty.Reward / 100000000} GAS`);
console.log(`Active: ${bounty.Active}`);
console.log(`Deadline: ${new Date(bounty.Deadline)}`);
```

#### Step 3: Approve Winner

```javascript
// After reviewing proofs, approve the best submission
const winnerAddress = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

await contract.invoke("ApproveClaim", [bountyId, winnerAddress]);
console.log(`Bounty completed! Winner: ${winnerAddress}`);
```

### For Bounty Hunters

#### Step 1: Find Bounties

```javascript
// Get bounty details
const bounty = await contract.call("GetBounty", [bountyId]);

if (bounty.Active) {
  console.log(`Task: ${bounty.Description}`);
  console.log(`Reward: ${bounty.Reward / 100000000} GAS`);
  console.log(`Time left: ${bounty.Deadline - Date.now()}ms`);
}
```

#### Step 2: Submit Your Proof

```javascript
// Complete the task and submit proof
const proof =
  "0x" + sha256("Found reentrancy bug in withdraw() function at line 156");

await contract.invoke("SubmitClaim", [bountyId, walletAddress, proof]);

console.log("Claim submitted! Waiting for creator review...");
```

### Strategy Tips

| Role        | Strategy                                     |
| ----------- | -------------------------------------------- |
| **Creator** | Write clear, specific task descriptions      |
| **Creator** | Set reasonable deadlines for task complexity |
| **Hunter**  | Submit detailed, verifiable proofs           |
| **Hunter**  | Focus on bounties matching your skills       |
| **Hunter**  | Submit early - first valid proof often wins  |

---

## Technical Reference

### Contract Information

| Property            | Value                  |
| ------------------- | ---------------------- |
| **Contract Name**   | MiniAppBountyHunter    |
| **App ID**          | `miniapp-bountyhunter` |
| **Category**        | Marketplace / Tasks    |
| **Min Bounty**      | 1 GAS (100000000)      |
| **Max Description** | 500 characters         |

### Data Structure

```csharp
struct BountyData {
    UInt160 Creator;        // Bounty creator's address
    string Description;     // Task description (max 500 chars)
    BigInteger Reward;      // GAS reward amount
    BigInteger Deadline;    // Unix timestamp deadline
    bool Active;            // True = accepting submissions
    UInt160 Winner;         // Winner's address (if completed)
}
```

### Contract Methods

#### CreateBounty

Creates a new bounty with locked reward.

```csharp
BigInteger CreateBounty(
    UInt160 creator,          // Creator's address
    string description,       // Task description
    BigInteger reward,        // GAS reward (min 1 GAS)
    BigInteger deadlineDays,  // Days until expiry
    BigInteger receiptId      // Payment receipt ID
)
```

**Returns:** `bountyId` - Unique identifier for the bounty

**Events:** `BountyCreated(bountyId, creator, reward)`

#### SubmitClaim

Submits proof of task completion.

```csharp
void SubmitClaim(
    BigInteger bountyId,      // Bounty to claim
    UInt160 hunter,           // Hunter's address
    ByteString proof          // Proof of completion
)
```

**Events:** `BountyClaimed(bountyId, hunter, proof)`

#### ApproveClaim

Creator approves a hunter's submission.

```csharp
void ApproveClaim(
    BigInteger bountyId,      // Bounty ID
    UInt160 hunter            // Winning hunter's address
)
```

**Events:** `BountyCompleted(bountyId, winner)`

#### GetBounty (Safe/Read-only)

Retrieves bounty information.

```csharp
BountyData GetBounty(BigInteger bountyId)
```

### Events

| Event             | Parameters                | Description         |
| ----------------- | ------------------------- | ------------------- |
| `BountyCreated`   | bountyId, creator, reward | New bounty posted   |
| `BountyClaimed`   | bountyId, hunter, proof   | Submission received |
| `BountyCompleted` | bountyId, winner          | Bounty paid out     |

---

## Use Cases

### Development

- **Bug bounties** - Find security vulnerabilities
- **Code reviews** - Review pull requests
- **Documentation** - Write technical docs

### Creative

- **Design tasks** - Create logos, UI mockups
- **Content creation** - Write articles, tutorials
- **Translation** - Localize content

### Research

- **Data collection** - Gather specific information
- **Analysis** - Perform market research
- **Testing** - QA and user testing

---

## Security & Fair Play

| Aspect               | Protection                           |
| -------------------- | ------------------------------------ |
| **Locked Rewards**   | GAS locked until bounty completed    |
| **Deadline Enforce** | Cannot submit after deadline         |
| **Proof Storage**    | All submissions permanently on-chain |
| **Creator Control**  | Only creator can approve winners     |

### Important Notes

- **No refunds** - Bounty rewards are locked until completion
- **One winner** - Only one hunter can win per bounty
- **Deadline strict** - Submissions rejected after deadline
- **Creator trust** - Hunters trust creator to fairly review

---

**Contract**: MiniAppBountyHunter
**Author**: R3E Network
**Version**: 1.0.0
