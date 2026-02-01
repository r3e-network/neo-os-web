# Developer Tutorials Design

**Date:** 2025-01-23
**Status:** Approved
**Author:** AI Design Partner

## Overview

This design documents a series of step-by-step tutorials to improve Developer Docs from 6/10 to 9/10 by providing guided learning paths for MiniApp development.

**Problem:** Existing documentation has comprehensive API references and 70+ example apps, but lacks step-by-step tutorials that guide developers through building specific MiniApp types.

**Solution:** Create 3 progressive tutorials covering core MiniApp patterns: payments, gaming, and governance.

## Tutorial Series Structure

### Progressive Learning Path

| Tutorial              | Level        | Time   | Prerequisites     | Skills Learned                                   |
| --------------------- | ------------ | ------ | ----------------- | ------------------------------------------------ |
| 1. Payment MiniApp    | Beginner     | 45 min | Node.js, basic JS | Wallet, GAS payments, manifest                   |
| 2. Provably Fair Game | Intermediate | 60 min | Tutorial 1        | Randomness, game state, leaderboards             |
| 3. Governance Voting  | Advanced     | 75 min | Tutorial 1        | On-chain voting, contract interaction, proposals |

### Tutorial Structure Template

Each tutorial follows a consistent 7-section format:

1. **What You'll Build** - Screenshot, feature list, success criteria
2. **Prerequisites & Setup** - Software, accounts, environment
3. **Step-by-Step Implementation** - Code snippets with explanations
4. **Testing Your MiniApp** - Local testing instructions
5. **Deploying to Platform** - Manifest registration, approval workflow
6. **Full Code Reference** - Link to complete example
7. **Next Steps** - Related tutorials, advanced topics

### File Organization

```
docs/
├── tutorials/
│   ├── 01-payment-miniapp/
│   │   ├── README.md           # Main tutorial content
│   │   ├── assets/
│   │   │   ├── screenshot.png  # Completed app screenshot
│   │   │   └── diagram.svg     # Architecture diagram
│   │   └── code/
│   │       ├── manifest.json   # Starting template
│   │       ├── app.html        # Step-by-step versions
│   │       └── final/          # Complete solution
│   ├── 02-provably-fair-game/
│   └── 03-governance-voting/
├── TUTORIAL_INDEX.md           # Overview & navigation
└── QUICKSTART.md               # Existing (unchanged)
```

## Tutorial 1: Payment MiniApp

**Title:** "Build Your First Payment MiniApp - A Tip Jar"

**Reference Example:** `miniapps-uniapp/apps/dev-tipping/`

### Skills Learned

- MiniApp SDK initialization
- NeoLine wallet connection
- GAS payment requests
- Manifest validation
- Platform registration workflow

### Step Breakdown

| Step               | Time   | Description                      |
| ------------------ | ------ | -------------------------------- |
| 1. Create Manifest | 5 min  | Explain manifest.json fields     |
| 2. HTML Structure  | 5 min  | Basic UI with tip button         |
| 3. Connect Wallet  | 10 min | `getAddress()`, error handling   |
| 4. Request Payment | 15 min | `payGAS()`, `invokeIntent()`     |
| 5. User Feedback   | 5 min  | Loading states, success/error UI |
| 6. Test Locally    | 5 min  | Platform host local testing      |

### Key Code Pattern

```javascript
// Payment flow
const intent = await MiniAppSDK.payments.payGAS(
    "com.example.tipjar",
    "100000000", // 0.001 GAS
    "tip-memo"
);
const result = await MiniAppSDK.wallet.invokeIntent(intent.request_id);
```

### Testing Checklist

- [ ] Wallet connects successfully
- [ ] Payment request creates intent
- [ ] User can approve/reject in NeoLine
- [ ] Success/failure feedback works
- [ ] TX hash displayed on success

## Tutorial 2: Provably Fair Game

**Title:** "Build a Provably Fair Game - Lucky Coin Flip"

**Reference Example:** `miniapps-uniapp/apps/coin-flip/`

### Skills Learned

- TEE randomness integration (VRF)
- Game state management
- Payment + randomness combo
- Leaderboard display
- Odds calculation

### Step Breakdown

| Step                     | Time   | Description                          |
| ------------------------ | ------ | ------------------------------------ |
| 1. Enhanced Manifest     | 5 min  | Add `permissions.rng`, higher limits |
| 2. Game UI Components    | 10 min | Betting input, coin flip button      |
| 3. Request Randomness    | 10 min | `requestRandom()`, hex conversion    |
| 4. Integrate Payment     | 10 min | Combine Tutorial 1 payment flow      |
| 5. Game State Management | 10 min | Track wins/losses, localStorage      |
| 6. Leaderboard           | 5 min  | Display top players (mock data)      |
| 7. Testing               | 10 min | Verify fairness, win/loss scenarios  |

### Key Code Pattern

```javascript
// Provably fair outcome
const randomness = await MiniAppSDK.rng.requestRandom(appId);
const byteValue = parseInt(randomness.randomness.slice(0, 2), 16);
const outcome = byteValue % 2; // 0 = heads, 1 = tails
const won = outcome === userGuess;
```

### Testing Checklist

- [ ] Randomness is provably fair (VRF explained)
- [ ] Win/loss scenarios work correctly
- [ ] Payment deductions match bets
- [ ] Game state persists (localStorage)
- [ ] Leaderboard displays correctly

## Tutorial 3: Governance Voting

**Title:** "Build a Governance Voting App - Candidate Registration"

**Reference Example:** `miniapps-uniapp/apps/candidate-vote/`

### Skills Learned

- On-chain voting interaction
- Reading smart contract data
- Proposal lifecycle management
- Multi-state UI (pending → active → closed)
- Real-time vote counting

### Step Breakdown

| Step                      | Time   | Description                       |
| ------------------------- | ------ | --------------------------------- |
| 1. Governance Manifest    | 5 min  | Add `permissions.gov`, NEO assets |
| 2. Candidate List Display | 10 min | Fetch from contract, display info |
| 3. Vote Casting           | 15 min | `vote()`, sign with NEO           |
| 4. Read Contract State    | 10 min | `getCandidates()`, parse data     |
| 5. Epoch Management       | 10 min | Display epoch, countdown          |
| 6. Proposal Status        | 10 min | Track state transitions           |
| 7. Advanced Features      | 5 min  | Delegation, withdrawal, rewards   |

### Architecture

```
User → Vote → NEO Smart Contract
              ↓
         MiniApp ← Read State
              ↓
         UI Update (real-time)
```

### Key Code Pattern

```javascript
// Cast vote with NEO
const voteIntent = await MiniAppSDK.governance.vote(candidateAddress, voteAmount);
const result = await MiniAppSDK.wallet.invokeIntent(voteIntent.request_id);
```

### Testing Checklist

- [ ] Candidate list loads from contract
- [ ] Vote transaction executes successfully
- [ ] Vote counts update in real-time
- [ ] Epoch countdown displays correctly
- [ ] Proposal status transitions properly

## Implementation Plan

### Phase 1: Tutorial 1 (Payment MiniApp)

- [ ] Create directory structure
- [ ] Write tutorial content (1500-2000 words)
- [ ] Create code templates (manifest, HTML steps)
- [ ] Add screenshot/diagram assets
- [ ] Test tutorial end-to-end

### Phase 2: Tutorial 2 (Game MiniApp)

- [ ] Write tutorial content (2000-2500 words)
- [ ] Create code templates with randomness
- [ ] Add VRF explanation sidebar
- [ ] Create game state diagram
- [ ] Test tutorial end-to-end

### Phase 3: Tutorial 3 (Governance MiniApp)

- [ ] Write tutorial content (2500-3000 words)
- [ ] Create code templates with contract interaction
- [ ] Add proposal lifecycle diagram
- [ ] Add voting architecture diagram
- [ ] Test tutorial end-to-end

### Phase 4: Index & Polish

- [ ] Create TUTORIAL_INDEX.md navigation
- [ ] Cross-link related tutorials
- [ ] Add "Next Steps" references
- [ ] Review all tutorials for consistency
- [ ] Proofread and final polish

## Success Criteria

- [x] Tutorial series design approved
- [ ] All 3 tutorials written with code examples
- [ ] Screenshots/diagrams for each tutorial
- [ ] Tutorials tested by fresh developer
- [ ] Developer Docs score: 9/10
- [ ] Platform Maturity Score: 8.9/10 (from 8.4/10)

## Open Questions

None - design approved and ready for implementation.
