# Build a Provably Fair Game - Lucky Coin Flip

> **Time:** 60 minutes | **Level:** Intermediate | **Prerequisites:** Tutorial 1 | **Skills:** VRF Randomness, Game State, Leaderboards

## What You'll Build

A provably fair coin-flip betting game where:

- ✅ Users bet on heads or tails
- ✅ Outcome determined by TEE randomness (VRF)
- ✅ Automatic GAS payouts on wins
- ✅ Game statistics and leaderboards
- ✅ All outcomes verifiable on-chain

![Coin Flip Game](assets/screenshot.png)

**Why "Provably Fair"?**

The randomness comes from a Trusted Execution Environment (TEE) that generates cryptographically provable random numbers. Neither the platform nor the developer can predict or manipulate the outcome.

## Prerequisites

- ✅ **Tutorial 1 completed** - You understand wallet connections and payments
- **NeoLine N3 Wallet** with testnet GAS
- **Basic understanding** of JavaScript arrays and localStorage

## Setup

```bash
mkdir coin-flip-game
cd coin-flip-game
```

## Step 1: Enhanced Manifest (5 min)

Create `manifest.json` with randomness permissions:

```json
{
    "app_id": "com.example.coinflip",
    "version": "1.0.0",
    "name": "Lucky Coin Flip",
    "description": "Provably fair coin flip game",
    "icon": "https://your-cdn.com/coin-flip/icon.png",
    "banner": "https://your-cdn.com/coin-flip/banner.png",
    "category": "games",
    "entry_url": "https://your-cdn.com/coin-flip/",
    "supported_chains": ["neo-n3-testnet"],
    "permissions": {
        "read_address": true,
        "payments": true,
        "rng": true
    },
    "assets_allowed": ["GAS"],
    "limits": {
        "max_gas_per_tx": "500000000",
        "daily_gas_cap_per_user": "5000000000"
    },
    "contracts": {
        "neo-n3-testnet": {
            "address": "",
            "entry_url": ""
        }
    }
}
```

**New Permissions:**

- `rng: true` - Required for VRF randomness access

## Step 2: Game UI Components (10 min)

Create `index.html` with game interface:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Lucky Coin Flip</title>
        <style>
            body {
                font-family: -apple-system, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: white;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
            }
            .game-container {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                padding: 30px;
                max-width: 500px;
                width: 100%;
                backdrop-filter: blur(10px);
            }
            h1 {
                text-align: center;
                margin-bottom: 10px;
            }
            .balance {
                text-align: center;
                font-size: 24px;
                color: #ffd700;
                margin-bottom: 30px;
            }
            .coin-display {
                width: 150px;
                height: 150px;
                margin: 20px auto;
                border-radius: 50%;
                background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
                transition: transform 1s;
                cursor: pointer;
                border: 8px solid #fff;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
            }
            .coin-display:hover {
                transform: scale(1.05);
            }
            .coin-display.flipping {
                animation: flip 1s ease-in-out;
            }
            @keyframes flip {
                0% {
                    transform: rotateY(0deg);
                }
                50% {
                    transform: rotateY(1800deg) scale(0.1);
                }
                100% {
                    transform: rotateY(3600deg);
                }
            }
            .bet-controls {
                display: flex;
                gap: 10px;
                margin: 20px 0;
                justify-content: center;
            }
            .bet-btn {
                padding: 15px 30px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s;
            }
            .bet-btn:hover,
            .bet-btn.selected {
                background: rgba(255, 215, 0, 0.3);
                border-color: #ffd700;
            }
            .amount-input {
                width: 100%;
                padding: 12px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                font-size: 16px;
                margin-bottom: 15px;
            }
            .amount-input:focus {
                outline: none;
                border-color: #ffd700;
            }
            .flip-btn {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
                border: none;
                border-radius: 10px;
                color: #1a1a2e;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .flip-btn:hover {
                transform: translateY(-2px);
            }
            .flip-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            .status {
                text-align: center;
                padding: 15px;
                border-radius: 10px;
                margin-top: 20px;
                font-size: 16px;
                display: none;
            }
            .status.success {
                background: rgba(40, 167, 69, 0.3);
                display: block;
            }
            .status.error {
                background: rgba(220, 53, 69, 0.3);
                display: block;
            }
            .status.loading {
                background: rgba(255, 193, 7, 0.3);
                display: block;
            }
            .stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-top: 30px;
            }
            .stat-box {
                background: rgba(255, 255, 255, 0.05);
                padding: 15px;
                border-radius: 10px;
                text-align: center;
            }
            .stat-label {
                font-size: 12px;
                opacity: 0.7;
            }
            .stat-value {
                font-size: 20px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="game-container">
            <h1>🪙 Lucky Coin Flip</h1>
            <div class="balance">Balance: <span id="balance">0</span> GAS</div>

            <div id="coin" class="coin-display">?</div>

            <div class="bet-controls">
                <button class="bet-btn" data-guess="heads">HEADS</button>
                <button class="bet-btn" data-guess="tails">TAILS</button>
            </div>

            <input
                type="number"
                id="bet-amount"
                class="amount-input"
                placeholder="Bet amount (GAS)"
                min="0.001"
                step="0.001"
                value="0.01"
            />

            <button id="flip-btn" class="flip-btn">FLIP (0.01 GAS)</button>

            <div id="status" class="status"></div>

            <div class="stats">
                <div class="stat-box">
                    <div class="stat-label">Wins</div>
                    <div class="stat-value" id="wins">0</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Losses</div>
                    <div class="stat-value" id="losses">0</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Win Rate</div>
                    <div class="stat-value" id="winrate">0%</div>
                </div>
            </div>
        </div>

        <script>
            const APP_ID = "com.example.coinflip";
            let userAddress = null;
            let selectedGuess = null;
            let gameState = {
                balance: 0,
                wins: 0,
                losses: 0,
            };

            // Load saved game state
            function loadGameState() {
                const saved = localStorage.getItem("coinflip-state");
                if (saved) {
                    gameState = JSON.parse(saved);
                    updateUI();
                }
            }

            // Save game state
            function saveGameState() {
                localStorage.setItem("coinflip-state", JSON.stringify(gameState));
            }

            // Update UI
            function updateUI() {
                document.getElementById("balance").textContent = gameState.balance.toFixed(4);
                document.getElementById("wins").textContent = gameState.wins;
                document.getElementById("losses").textContent = gameState.losses;
                const total = gameState.wins + gameState.losses;
                const rate = total > 0 ? Math.round((gameState.wins / total) * 100) : 0;
                document.getElementById("winrate").textContent = rate + "%";
            }

            function showStatus(message, type) {
                const status = document.getElementById("status");
                status.textContent = message;
                status.className = `status ${type}`;
            }

            // Check SDK
            function checkSDK() {
                if (typeof window.MiniAppSDK === "undefined") {
                    showStatus("SDK not available. Use platform host.", "error");
                    return false;
                }
                return true;
            }

            // Connect wallet
            async function connectWallet() {
                if (!checkSDK()) return;
                try {
                    userAddress = await window.MiniAppSDK.wallet.getAddress();
                    showStatus("Connected! Place your bet.", "success");
                    document.getElementById("flip-btn").disabled = false;
                } catch (error) {
                    showStatus(`Connection failed: ${error.message}`, "error");
                }
            }

            // Get game balance (mock for tutorial)
            async function getBalance() {
                // In production, this would query the blockchain
                // For tutorial, we use localStorage
                return gameState.balance;
            }

            // Bet selection
            document.querySelectorAll(".bet-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    document
                        .querySelectorAll(".bet-btn")
                        .forEach((b) => b.classList.remove("selected"));
                    btn.classList.add("selected");
                    selectedGuess = btn.dataset.guess;
                    updateFlipButton();
                });
            });

            function updateFlipButton() {
                const amount = document.getElementById("bet-amount").value;
                document.getElementById("flip-btn").textContent = `FLIP (${amount} GAS)`;
            }

            document.getElementById("bet-amount").addEventListener("input", updateFlipButton);

            // Main game logic - provably fair!
            document.getElementById("flip-btn").addEventListener("click", async () => {
                if (!checkSDK() || !selectedGuess) {
                    showStatus("Select heads or tails first!", "error");
                    return;
                }

                const betAmount = parseFloat(document.getElementById("bet-amount").value);
                if (betAmount <= 0) {
                    showStatus("Enter a bet amount", "error");
                    return;
                }

                if (gameState.balance < betAmount) {
                    showStatus("Insufficient balance!", "error");
                    return;
                }

                try {
                    showStatus("Getting provably fair randomness...", "loading");
                    const coin = document.getElementById("coin");
                    coin.classList.add("flipping");
                    document.getElementById("flip-btn").disabled = true;

                    // Request randomness from TEE
                    const randomness = await window.MiniAppSDK.rng.requestRandom(APP_ID);

                    // Convert hex to number (provably fair!)
                    const byteValue = parseInt(randomness.randomness.slice(0, 2), 16);
                    const outcome = byteValue % 2; // 0 = heads, 1 = tails

                    setTimeout(() => {
                        coin.classList.remove("flipping");
                        coin.textContent = outcome === 0 ? "H" : "T";

                        const won =
                            (outcome === 0 && selectedGuess === "heads") ||
                            (outcome === 1 && selectedGuess === "tails");

                        if (won) {
                            // Double the bet for winning
                            gameState.balance += betAmount;
                            gameState.wins++;
                            showStatus(
                                `🎉 ${outcome === 0 ? "HEADS" : "TAILS"}! You win ${betAmount * 2} GAS!`,
                                "success"
                            );
                        } else {
                            gameState.balance -= betAmount;
                            gameState.losses++;
                            showStatus(
                                `😢 ${outcome === 0 ? "HEADS" : "TAILS"}! You lost ${betAmount} GAS.`,
                                "error"
                            );
                        }

                        saveGameState();
                        updateUI();
                        document.getElementById("flip-btn").disabled = false;
                    }, 1000);
                } catch (error) {
                    console.error("Game error:", error);
                    showStatus(`Game failed: ${error.message}`, "error");
                    document.getElementById("coin").classList.remove("flipping");
                    document.getElementById("flip-btn").disabled = false;
                }
            });

            // Initialize
            loadGameState();
            connectWallet();
        </script>
    </body>
</html>
```

## Step 3: How VRF Randomness Works (Important!)

The randomness comes from a **Trusted Execution Environment (TEE)**:

1. **Request:** Your app calls `MiniAppSDK.rng.requestRandom()`
2. **Generate:** TEE generates random bytes using hardware entropy
3. **Attest:** Signs the randomness with a cryptographic proof
4. **Return:** Returns `{ randomness: "0xabcd...", attestation: {...} }`

**Why Provably Fair?**

- Randomness generated **after** you place your bet
- Neither you nor the platform can predict the outcome
- Attestation can be verified on-chain

```javascript
// Convert random bytes to game outcome
const byteValue = parseInt(randomness.randomness.slice(0, 2), 16);
const outcome = byteValue % 2; // Even = heads, Odd = tails
```

## Step 4: Testing (10 min)

**Test Checklist:**

- [ ] Heads/tails selection works
- [ ] Bet amount updates button text
- [ ] Coin animation plays
- [ ] Randomness returns successfully
- [ ] Win/loss updates balance correctly
- [ ] Game state saves to localStorage
- [ ] Win rate calculates correctly

## Step 5: Deploy

Same deployment process as Tutorial 1:

1. Upload to CDN
2. Update manifest with CDN URL
3. Register via `/functions/v1/app-register`
4. Wait for approval

## Full Code Reference

- `https://github.com/r3e-network/miniapps/tree/main/apps/coin-flip` - Production example
- `docs/tutorials/01-payment-miniapp/code/final/` - Tutorial 1 reference

## Next Steps

**Tutorial 3:** [Build a Governance Voting App](../03-governance-voting/) - Learn on-chain voting with NEO

**Advanced:**

- Add multiplayer leaderboards
- Implement side bets
- Create jackpot system
