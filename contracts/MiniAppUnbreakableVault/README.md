# MiniAppUnbreakableVault

## What is UnbreakableVault?

UnbreakableVault is a **hacker bounty challenge game** on the Neo N3 blockchain. Creators set up "vaults" protected by secret passwords (stored as SHA256 hashes), with GAS bounties locked inside. Hackers pay attempt fees to try breaking the vault by guessing the secret. Each failed attempt increases the bounty, making the prize more attractive.

**Think of it as:** A digital safe-cracking challenge where the prize grows with every failed attempt.

---

## 中文说明

### 什么是不可破解保险箱？

不可破解保险箱是一个基于 Neo N3 区块链的**黑客悬赏挑战游戏**。创建者设置由密码保护的"保险箱"（以 SHA256 哈希存储），并锁定 GAS 赏金。黑客支付尝试费用来破解保险箱。每次失败的尝试都会增加赏金，使奖励更具吸引力。

**简单理解：** 数字保险箱破解挑战，每次失败尝试都会让奖金增加。

---

## How It Works

### Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  UNBREAKABLE VAULT FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATOR SETS UP VAULT                                   │
│     ┌──────────────────────────────────────┐                │
│     │ Secret: "MyS3cr3tP@ssw0rd"           │                │
│     │ Hash: SHA256(secret) stored on-chain │                │
│     │ Initial Bounty: 5 GAS                │                │
│     │ Status: LOCKED 🔒                    │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  2. HACKERS ATTEMPT TO BREAK                                │
│     ┌──────────────────────────────────────┐                │
│     │ Hacker A: "password123" ❌ (+0.1)    │                │
│     │ Hacker B: "admin" ❌ (+0.1)          │                │
│     │ Hacker C: "secret" ❌ (+0.1)         │                │
│     │ Bounty grows: 5.3 GAS                │                │
│     └──────────────────────────────────────┘                │
│                         │                                   │
│                         ▼                                   │
│  3. VAULT BROKEN!                                           │
│     ┌──────────────────────────────────────┐                │
│     │ Hacker D: "MyS3cr3tP@ssw0rd" ✅      │                │
│     │ SHA256 matches stored hash!          │                │
│     │ 🏆 Hacker D wins 5.4 GAS             │                │
│     │ Status: BROKEN 🔓                    │                │
│     └──────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Mechanics

| Mechanic           | Value    | Description                      |
| ------------------ | -------- | -------------------------------- |
| **Min Bounty**     | 1 GAS    | Minimum initial vault bounty     |
| **Attempt Fee**    | 0.1 / 0.5 / 1 GAS | Cost per break attempt (Easy/Medium/Hard) |
| **Hash Algorithm** | SHA256   | 32-byte hash protection          |
| **Bounty Growth**  | +attempt fee | Each attempt adds to bounty   |
| **Winner Takes**   | 100%     | Full bounty to successful hacker |

---

## User Guide

### For Vault Creators

#### Create a Vault

```javascript
// Choose a strong secret
const secret = "MyS3cr3tP@ssw0rd!2024";
const secretHash = await crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode(secret),
);

const bounty = 5; // 5 GAS initial bounty
await gasContract.transfer(walletAddress, contractHash, bounty * 100000000, "miniapp-unbreakablevault:create");

const difficulty = 1; // 1=Easy, 2=Medium, 3=Hard
const title = "Genesis Vault";
const description = "Optional hints or lore";

const vaultId = await contract.invoke("CreateVault", [
  walletAddress,
  secretHash,
  bounty * 100000000,
  difficulty,
  title,
  description,
]);

console.log(`Vault #${vaultId} created with ${bounty} GAS bounty`);
// Keep your secret safe - if someone guesses it, they win!
```

### For Hackers

#### Check Vault Status

```javascript
const vault = await contract.call("GetVaultDetails", [vaultId]);

console.log(`Current Bounty: ${vault.bounty / 100000000} GAS`);
console.log(`Attempts Made: ${vault.attemptCount}`);
console.log(`Broken: ${vault.broken}`);
```

#### Attempt to Break

```javascript
const myGuess = "password123"; // Your guess
await gasContract.transfer(walletAddress, contractHash, 0.1 * 100000000, "miniapp-unbreakablevault:attempt");

const success = await contract.invoke("AttemptBreak", [
  vaultId,
  walletAddress,
  myGuess,
]);

if (success) {
  console.log("🎉 VAULT BROKEN! You win the bounty!");
} else {
  console.log("❌ Wrong secret. Bounty increased!");
}
```

### Strategy Tips

| Role        | Strategy                              |
| ----------- | ------------------------------------- |
| **Creator** | Use long, complex secrets             |
| **Creator** | Mix letters, numbers, symbols         |
| **Hacker**  | Research common password patterns     |
| **Hacker**  | Calculate ROI: bounty vs attempt cost |
| **Hacker**  | High attempt count = harder secret    |

---

## Technical Reference

### Contract Information

| Property          | Value                       |
| ----------------- | --------------------------- |
| **Contract Name** | MiniAppUnbreakableVault     |
| **App ID**        | `miniapp-unbreakablevault`  |
| **Category**      | Gaming / Security Challenge |
| **Min Bounty**    | 1 GAS (100000000)           |
| **Attempt Fee**   | 0.1 / 0.5 / 1 GAS (Easy/Medium/Hard) |
| **Hash**          | SHA256 (32 bytes)           |

### Data Structure

```csharp
struct VaultData {
    UInt160 Creator;        // Vault creator
    BigInteger Bounty;      // Current bounty amount
    ByteString SecretHash;  // SHA256 hash of secret
    BigInteger AttemptCount;// Number of attempts
    BigInteger Difficulty;  // 1=Easy, 2=Medium, 3=Hard
    BigInteger CreatedTime;
    BigInteger ExpiryTime;
    BigInteger HintsRevealed;
    bool Broken;            // True when cracked
    bool Expired;           // True when expired
    UInt160 Winner;         // Winner's address
    string Title;
    string Description;
}
```

### Contract Methods

#### CreateVault

Creates a new vault with bounty.

```csharp
BigInteger CreateVault(
    UInt160 creator,
    ByteString secretHash,
    BigInteger bounty,
    BigInteger difficulty,
    string title,
    string description,
    BigInteger receiptId
)
```

**Returns:** `vaultId`

**Events:** `VaultCreated(vaultId, creator, bounty, difficulty)`

#### AttemptBreak

Attempts to break the vault.

```csharp
bool AttemptBreak(
    BigInteger vaultId,
    UInt160 attacker,
    ByteString secret,
    BigInteger receiptId
)
```

**Returns:** `true` if successful

**Events:**

- `AttemptMade(vaultId, attacker, success, attemptNumber)`
- `VaultBroken(vaultId, winner, reward)` - if successful

### Events

| Event          | Parameters                 | Description     |
| -------------- | -------------------------- | --------------- |
| `VaultCreated` | vaultId, creator, bounty, difficulty | New vault made  |
| `AttemptMade`  | vaultId, attacker, success, attemptNumber | Break attempted |
| `VaultBroken`  | vaultId, winner, reward    | Vault cracked   |

---

## Security & Fair Play

| Aspect             | Protection                       |
| ------------------ | -------------------------------- |
| **Hash Storage**   | Only SHA256 hash stored on-chain |
| **Secret Hidden**  | Original secret never revealed   |
| **Growing Bounty** | Failed attempts increase reward  |
| **One Winner**     | First correct guess wins all     |

---

**Contract**: MiniAppUnbreakableVault
**Author**: R3E Network
**Version**: 2.0.0
