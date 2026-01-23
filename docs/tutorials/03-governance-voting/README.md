# Build a Governance Voting App - Candidate Registration

> **Time:** 75 minutes | **Level:** Advanced | **Prerequisites:** Tutorial 1 | **Skills:** On-chain Voting, Contract Interaction, Proposals

## What You'll Build

A decentralized governance voting application where:

- ✅ Users vote for candidates with NEO tokens
- ✅ Real-time vote counting from smart contract
- ✅ Candidate list with detailed information
- ✅ Epoch countdown and rewards tracking
- ✅ Proposal lifecycle management (pending → active → closed)
- ✅ Vote delegation and withdrawal support

![Governance Voting](assets/screenshot.png)

**Why On-Chain Governance?**

Votes are recorded directly on the NEO blockchain, ensuring transparency, immutability, and censorship resistance. No central authority can manipulate or invalidate legitimate votes.

## Prerequisites

- ✅ **Tutorial 1 completed** - You understand wallet connections and payments
- **NeoLine N3 Wallet** with testnet NEO
- **Basic understanding** of smart contracts and blockchain concepts
- **Familiarity** with async/await JavaScript patterns

## Setup

```bash
mkdir governance-voting
cd governance-voting
```

## Step 1: Governance Manifest (5 min)

Create `manifest.json` with governance permissions:

```json
{
    "app_id": "com.example.govvote",
    "version": "1.0.0",
    "name": "Candidate Voting",
    "name_zh": "候选人投票",
    "description": "Vote for platform candidates and earn rewards",
    "description_zh": "为平台候选人投票并获得奖励",
    "icon": "https://your-cdn.com/gov-vote/assets/icon.png",
    "banner": "https://your-cdn.com/gov-vote/assets/banner.png",
    "category": "governance",
    "entry_url": "https://your-cdn.com/gov-vote/",
    "supported_chains": ["neo-n3-testnet"],
    "permissions": {
        "read_address": true,
        "governance": true
    },
    "assets_allowed": ["GAS"],
    "governance_assets_allowed": ["NEO"],
    "limits": {
        "max_gas_per_tx": "500000000",
        "daily_gas_cap_per_user": "5000000000"
    },
    "contracts": {
        "neo-n3-testnet": {
            "address": "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"
        }
    }
}
```

**New Fields:**

- `governance_assets_allowed`: NEO for voting
- `permissions.governance`: Required for voting operations
- `contracts.address`: Governance contract address

## Step 2: Contract Reading Architecture (10 min)

Before building the UI, understand how to read from smart contracts:

```javascript
// Contract reading pattern
async function readContract({ contractHash, method, args = [] }) {
    const response = await fetch(`${RPC_URL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "invokefunction",
            params: [contractHash, method, args],
            id: 1,
        }),
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    // Return first stack item (simplified)
    return data.result.stack[0];
}

// Example: Get candidate info
const candidate = await readContract({
    contractHash: CONTRACT_HASH,
    method: "getCandidate",
    args: [{ type: "Hash", value: candidateHash }],
});
```

**Key Concepts:**

- **RPC Endpoint**: Neo N3 JSON-RPC API for contract interaction
- **invokefunction**: Read-only contract calls (no gas cost)
- **Stack**: Contract returns data in stack format
- **Types**: Hash, Address, Integer, ByteString, Array

## Step 3: Candidate List Display (15 min)

Create `index.html` with candidate list:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Governance Voting</title>
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            body {
                font-family: -apple-system, sans-serif;
                background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
                color: white;
                min-height: 100vh;
                padding: 20px;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
            }

            .header {
                text-align: center;
                margin-bottom: 40px;
            }

            .epoch-banner {
                background: rgba(255, 215, 0, 0.2);
                border: 2px solid #ffd700;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 20px;
            }

            .epoch-info h2 {
                color: #ffd700;
                margin-bottom: 5px;
            }

            .countdown {
                font-size: 24px;
                font-weight: bold;
                color: #ffd700;
            }

            .candidates-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
            }

            .candidate-card {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 20px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: transform 0.3s;
            }

            .candidate-card:hover {
                transform: translateY(-5px);
            }

            .candidate-header {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 15px;
            }

            .candidate-avatar {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }

            .candidate-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .candidate-address {
                font-size: 12px;
                opacity: 0.7;
                font-family: monospace;
            }

            .vote-stats {
                display: flex;
                justify-content: space-between;
                margin: 15px 0;
                padding: 15px 0;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .stat {
                text-align: center;
            }

            .stat-label {
                font-size: 12px;
                opacity: 0.7;
                margin-bottom: 5px;
            }

            .stat-value {
                font-size: 20px;
                font-weight: bold;
                color: #ffd700;
            }

            .vote-btn {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 10px;
                color: white;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .vote-btn:hover {
                transform: translateY(-2px);
            }

            .vote-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .status-badge {
                display: inline-block;
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 10px;
            }

            .status-active {
                background: rgba(40, 167, 69, 0.3);
                color: #28a745;
            }

            .status-pending {
                background: rgba(255, 193, 7, 0.3);
                color: #ffc107;
            }

            .status-closed {
                background: rgba(108, 117, 125, 0.3);
                color: #6c757d;
            }

            .progress-bar {
                width: 100%;
                height: 8px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                overflow: hidden;
                margin: 10px 0;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                transition: width 0.5s;
            }

            .loading {
                text-align: center;
                padding: 40px;
                font-size: 18px;
                opacity: 0.7;
            }

            .error {
                background: rgba(220, 53, 69, 0.3);
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                margin: 20px 0;
            }

            .hidden {
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏛️ Governance Voting</h1>
                <p>Vote for candidates with NEO and shape the platform's future</p>
            </div>

            <div class="epoch-banner">
                <div class="epoch-info">
                    <h2>Current Epoch: <span id="epoch-number">Loading...</span></h2>
                    <p>Ends in: <span id="epoch-countdown" class="countdown">--:--:--</span></p>
                </div>
                <div class="epoch-stats">
                    <div>Total Votes: <span id="total-votes">0</span></div>
                    <div>Reward Pool: <span id="reward-pool">0</span> GAS</div>
                </div>
            </div>

            <div id="error-container" class="error hidden"></div>
            <div id="loading-container" class="loading">Loading candidates...</div>
            <div id="candidates-container" class="candidates-grid"></div>
        </div>

        <script>
            const APP_ID = "com.example.govvote";
            const CONTRACT_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
            const RPC_URL = "https://testnet.neo.org/rpc"; // Testnet RPC

            // For tutorial: mock data (in production, read from contract)
            const MOCK_CANDIDATES = [
                {
                    address: "NXsG3zBjwjaM7QouBqqeXtYzgLTCGhZagY",
                    name: "Alice Developer",
                    votes: "150000000000",
                    registered: true,
                    url: "https://example.com/alice",
                },
                {
                    address: "NM7Aky765FG8NhhcRXwfTVaHxNrQ4UVF4c",
                    name: "Bob Validator",
                    votes: "120000000000",
                    registered: true,
                    url: "https://example.com/bob",
                },
                {
                    address: "NQ9HmYiuNZxTGYcEaLHUDFEYbiqkNKqQ1L",
                    name: "Carol Community",
                    votes: "98000000000",
                    registered: true,
                    url: "https://example.com/carol",
                },
            ];

            let userAddress = null;
            let epochEndTime = null;

            // Check SDK
            function checkSDK() {
                return typeof window.MiniAppSDK !== "undefined";
            }

            // Format NEO amount
            function formatNeo(amount) {
                return (parseInt(amount) / 1e8).toFixed(2);
            }

            // Truncate address
            function truncateAddress(address) {
                return `${address.slice(0, 6)}...${address.slice(-6)}`;
            }

            // Calculate vote percentage
            function calculatePercentage(votes, total) {
                if (total === 0) return 0;
                return ((votes / total) * 100).toFixed(1);
            }

            // Update countdown
            function updateCountdown() {
                if (!epochEndTime) return;

                const now = Math.floor(Date.now() / 1000);
                const remaining = epochEndTime - now;

                if (remaining <= 0) {
                    document.getElementById("epoch-countdown").textContent = "Ended";
                    return;
                }

                const days = Math.floor(remaining / 86400);
                const hours = Math.floor((remaining % 86400) / 3600);
                const minutes = Math.floor((remaining % 3600) / 60);
                const seconds = remaining % 60;

                document.getElementById("epoch-countdown").textContent =
                    `${days}d ${hours}h ${minutes}m ${seconds}s`;
            }

            // Get initial letter for avatar
            function getInitial(name) {
                return name.charAt(0).toUpperCase();
            }

            // Render candidate card
            function renderCandidate(candidate, totalVotes) {
                const percentage = calculatePercentage(candidate.votes, totalVotes);
                const formattedVotes = formatNeo(candidate.votes);

                return `
                    <div class="candidate-card">
                        <span class="status-badge status-active">Active</span>
                        <div class="candidate-header">
                            <div class="candidate-avatar">${getInitial(candidate.name)}</div>
                            <div>
                                <div class="candidate-name">${candidate.name}</div>
                                <div class="candidate-address">${truncateAddress(candidate.address)}</div>
                            </div>
                        </div>
                        <div class="vote-stats">
                            <div class="stat">
                                <div class="stat-label">Votes</div>
                                <div class="stat-value">${formattedVotes}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Share</div>
                                <div class="stat-value">${percentage}%</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Rank</div>
                                <div class="stat-value">#</div>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <button class="vote-btn" onclick="voteForCandidate('${candidate.address}')">
                            Vote with NEO
                        </button>
                    </div>
                `;
            }

            // Load candidates (mock for tutorial)
            async function loadCandidates() {
                const loadingContainer = document.getElementById("loading-container");
                const candidatesContainer = document.getElementById("candidates-container");

                try {
                    loadingContainer.classList.remove("hidden");

                    // In production: Read from contract
                    // const candidates = await getCandidatesFromContract();

                    // For tutorial: Use mock data
                    const candidates = MOCK_CANDIDATES;

                    // Calculate total votes
                    const totalVotes = candidates.reduce((sum, c) => sum + parseInt(c.votes), 0);

                    // Update stats
                    document.getElementById("total-votes").textContent = formatNeo(totalVotes);

                    // Render candidates
                    candidatesContainer.innerHTML = candidates
                        .map((c) => renderCandidate(c, totalVotes))
                        .join("");

                    loadingContainer.classList.add("hidden");
                } catch (error) {
                    console.error("Failed to load candidates:", error);
                    showError("Failed to load candidates. Please try again.");
                    loadingContainer.classList.add("hidden");
                }
            }

            // Show error
            function showError(message) {
                const container = document.getElementById("error-container");
                container.textContent = message;
                container.classList.remove("hidden");
            }

            // Vote for candidate
            async function voteForCandidate(candidateAddress) {
                if (!checkSDK()) {
                    alert("This app must be run within the MiniApp platform.");
                    return;
                }

                try {
                    // Get user's NEO balance (for tutorial, just prompt)
                    const voteAmount = prompt("Enter NEO amount to vote:", "10");

                    if (!voteAmount) return;

                    const amountFloat = parseFloat(voteAmount);
                    if (isNaN(amountFloat) || amountFloat <= 0) {
                        alert("Please enter a valid NEO amount.");
                        return;
                    }

                    // Convert to satoshis
                    const satoshis = Math.floor(amountFloat * 1e8).toString();

                    showStatus(
                        `Voting ${amountFloat} NEO for ${truncateAddress(candidateAddress)}...`
                    );

                    // Create vote intent
                    const voteIntent = await window.MiniAppSDK.governance.vote(
                        APP_ID,
                        candidateAddress,
                        satoshis
                    );

                    // Invoke through wallet
                    const result = await window.MiniAppSDK.wallet.invokeIntent(
                        voteIntent.request_id
                    );

                    showStatus(`✓ Vote cast! TX: ${result.tx_id.slice(0, 16)}...`, "success");

                    // Reload candidates after 3 seconds
                    setTimeout(() => {
                        loadCandidates();
                        hideStatus();
                    }, 3000);
                } catch (error) {
                    console.error("Vote failed:", error);
                    alert(`Vote failed: ${error.message}`);
                }
            }

            // Initialize
            async function init() {
                // Set mock epoch end time (7 days from now)
                epochEndTime = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

                // Update countdown every second
                setInterval(updateCountdown, 1000);
                updateCountdown();

                document.getElementById("epoch-number").textContent = "142";

                // Load candidates
                await loadCandidates();

                // Update countdown every second
                setInterval(updateCountdown, 1000);
            }

            // Status display helpers
            function showStatus(message, type = "info") {
                const existing = document.querySelector(".status-message");
                if (existing) existing.remove();

                const status = document.createElement("div");
                status.className = "status-message";
                status.textContent = message;
                status.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: ${type === "success" ? "rgba(40, 167, 69, 0.9)" : "rgba(0, 0, 0, 0.8)"};
                    color: white;
                    padding: 15px 25px;
                    border-radius: 10px;
                    z-index: 1000;
                `;
                document.body.appendChild(status);
            }

            function hideStatus() {
                const status = document.querySelector(".status-message");
                if (status) status.remove();
            }

            // Start app
            init();
        </script>
    </body>
</html>
```

## Step 4: Understanding Vote Casting (15 min)

The voting flow differs from regular payments:

```javascript
// 1. Create vote intent (not payGAS!)
const voteIntent = await MiniAppSDK.governance.vote(
    APP_ID,
    candidateAddress, // Who to vote for
    "1000000000" // 10 NEO (in satoshis)
);

// 2. Invoke through wallet
const result = await MiniAppSDK.wallet.invokeIntent(voteIntent.request_id);

// 3. Verify on-chain
const txHash = result.tx_id;
```

**Key Differences from Payments:**

| Aspect    | Payments    | Voting                |
| --------- | ----------- | --------------------- |
| Asset     | GAS         | NEO                   |
| Method    | `payGAS()`  | `governance.vote()`   |
| Recipient | Any address | Registered candidates |
| Memo      | Optional    | Encoded in script     |

## Step 5: Contract Reading (Production)

For production, replace mock data with contract calls:

```javascript
async function getCandidatesFromContract() {
    const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "invokefunction",
            params: [CONTRACT_HASH, "getCandidates", []],
            id: 1,
        }),
    });

    const data = await response.json();
    const candidatesArray = data.result.stack[0].value;

    return candidatesArray.map((candidate) => ({
        address: candidate.value[0].value,
        name: hexToString(candidate.value[1].value),
        votes: candidate.value[2].value,
        registered: candidate.value[3].value,
    }));
}

function hexToString(hex) {
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}
```

## Step 6: Epoch Management (10 min)

Governance epochs have specific lifecycle:

```javascript
// Get current epoch info
async function getEpochInfo() {
    const response = await rpcCall("getblockcount", []);
    const currentBlock = response.result;

    // Calculate epoch from block height
    const epoch = Math.floor(currentBlock / BLOCKS_PER_EPOCH);
    const epochStartBlock = epoch * BLOCKS_PER_EPOCH;
    const blocksRemaining = (epoch + 1) * BLOCKS_PER_EPOCH - currentBlock;

    // Estimate time (15 seconds per block)
    const secondsRemaining = blocksRemaining * 15;

    return {
        epoch: epoch,
        startTime: Date.now() - (currentBlock - epochStartBlock) * 15 * 1000,
        endTime: Date.now() + secondsRemaining * 1000,
        blocksRemaining: blocksRemaining,
    };
}

// Update epoch display
async function updateEpochDisplay() {
    const epochInfo = await getEpochInfo();

    document.getElementById("epoch-number").textContent = epochInfo.epoch;
    epochEndTime = Math.floor(epochInfo.endTime / 1000);
    updateCountdown();
}
```

## Step 7: Testing (15 min)

**Test Checklist:**

- [ ] Candidate list displays correctly
- [ ] Vote percentages calculate properly
- [ ] Epoch countdown updates every second
- [ ] Vote button triggers wallet
- [ ] Vote transaction executes
- [ ] Success message shows TX hash
- [ ] Error handling works

**Test Scenarios:**

1. **Load Page**: Verify candidates display with correct vote totals
2. **Check Countdown**: Verify time decreases each second
3. **Cast Vote**: Enter amount, confirm in NeoLine
4. **Verify TX**: Check transaction hash displays
5. **Refresh**: Reload to verify votes updated

## Step 8: Deploy

Same deployment process as previous tutorials:

1. Upload to CDN
2. Update manifest with CDN URL
3. Register via `/functions/v1/app-register`
4. Wait for approval (governance apps require extra review)

## Architecture Diagram

```
┌─────────────┐
│   Voter     │
│  (User)     │
└──────┬──────┘
       │ Vote (NEO)
       ▼
┌─────────────────┐
│  NeoLine Wallet │
│  (Sign & Submit)│
└──────┬──────────┘
       │ Signed TX
       ▼
┌─────────────────┐
│ NEO Smart Chain │
│ (On-chain Vote) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Governance      │
│ Contract        │
│ - Count votes   │
│ - Update state  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MiniApp        │
│  (Read state)   │
│  - getCandidates│
│  - getVotes     │
└─────────────────┘
```

## Full Code Reference

- `miniapps-uniapp/apps/candidate-vote/` - Production example
- `contracts/MiniAppCandidateVote/` - Smart contract source

## Next Steps

**Advanced Features:**

- Implement vote delegation
- Add reward claiming
- Create proposal system
- Build analytics dashboard

**Related Tutorials:**

- [Tutorial 1: Payment MiniApp](../01-payment-miniapp/) - Wallet basics
- [Tutorial 2: Provably Fair Game](../02-provably-fair-game/) - Randomness

**Documentation:**

- [SDK API Documentation](../../API_DOCUMENTATION.md)
- [Manifest Specification](../../manifest-spec.md)
- [Governance Contract Spec](../../contracts/README.md)
