# Build Your First Payment MiniApp - A Tip Jar

> **Time:** 45 minutes | **Level:** Beginner | **Skills:** Wallet Connection, GAS Payments, Manifest Configuration

## What You'll Build

By the end of this tutorial, you'll have a fully functional MiniApp that:

- ✅ Connects to the user's NeoLine wallet
- ✅ Sends GAS payments with custom memos
- ✅ Displays transaction confirmations
- ✅ Handles errors gracefully
- ✅ Is ready to deploy to the Neo N3 MiniApp Platform

![Tip Jar MiniApp](assets/screenshot.png)

This is the simplest payment integration possible - perfect for learning the basics!

## Prerequisites

Before starting, make sure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **NeoLine N3 Wallet** browser extension ([Download](https://neoline.io/))
- **Testnet GAS** from the [faucet](https://neowish.neoline.io/)
- **Basic knowledge** of HTML and JavaScript
- **Text editor** (VS Code, Sublime, etc.)

### Accounts You'll Need

1. **Neo N3 Testnet Wallet** - Created via NeoLine
2. **Platform Developer Account** - Sign up at your platform instance
3. **Supabase Project** - For hosting your MiniApp bundle

## Setup

Create a new directory for your MiniApp:

```bash
mkdir tip-jar-miniapp
cd tip-jar-miniapp
```

Your project structure will look like this:

```
tip-jar-miniapp/
├── manifest.json       # MiniApp configuration
├── index.html          # Your app code
└── assets/
    ├── icon.png        # App icon (256x256)
    └── banner.png      # App banner (1200x630)
```

## Step 1: Create the Manifest

Every MiniApp needs a `manifest.json` file that describes it to the platform.

Create `manifest.json`:

```json
{
    "app_id": "com.example.tipjar",
    "version": "1.0.0",
    "name": "Tip Jar",
    "description": "A simple MiniApp for sending GAS tips",
    "icon": "https://your-cdn.com/tip-jar/assets/icon.png",
    "banner": "https://your-cdn.com/tip-jar/assets/banner.png",
    "category": "utilities",
    "entry_url": "https://your-cdn.com/tip-jar/",
    "supported_chains": ["neo-n3-testnet"],
    "permissions": {
        "read_address": true,
        "payments": true
    },
    "assets_allowed": ["GAS"],
    "limits": {
        "max_gas_per_tx": "100000000",
        "daily_gas_cap_per_user": "1000000000"
    },
    "contracts": {
        "neo-n3-testnet": {
            "address": "",
            "entry_url": ""
        }
    }
}
```

**Key Fields Explained:**

| Field                           | Purpose                                   |
| ------------------------------- | ----------------------------------------- |
| `app_id`                        | Unique identifier (reverse domain format) |
| `permissions.payments`          | Required for GAS payment functionality    |
| `assets_allowed`                | Only "GAS" is supported for payments      |
| `limits.max_gas_per_tx`         | Maximum per-transaction (0.1 GAS)         |
| `limits.daily_gas_cap_per_user` | Daily limit per user (1 GAS)              |

## Step 2: Create the HTML Structure

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Tip Jar MiniApp</title>
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .container {
                background: white;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 100%;
            }

            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 8px;
            }

            .subtitle {
                text-align: center;
                color: #666;
                margin-bottom: 24px;
                font-size: 14px;
            }

            .wallet-section {
                background: #f7f7f7;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
            }

            .wallet-address {
                font-family: monospace;
                font-size: 12px;
                color: #333;
                word-break: break-all;
                text-align: center;
            }

            .tip-amount {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                margin-bottom: 16px;
            }

            .tip-amount:focus {
                outline: none;
                border-color: #667eea;
            }

            .tip-buttons {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-bottom: 16px;
            }

            .tip-btn {
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }

            .tip-btn:hover {
                border-color: #667eea;
                background: #f0f0ff;
            }

            .send-tip-btn {
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .send-tip-btn:hover {
                transform: translateY(-2px);
            }

            .send-tip-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }

            .status {
                margin-top: 16px;
                padding: 12px;
                border-radius: 8px;
                font-size: 14px;
                text-align: center;
                display: none;
            }

            .status.success {
                background: #d4edda;
                color: #155724;
                display: block;
            }

            .status.error {
                background: #f8d7da;
                color: #721c24;
                display: block;
            }

            .status.loading {
                background: #fff3cd;
                color: #856404;
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>💰 Tip Jar</h1>
            <p class="subtitle">Send GAS tips to the developer</p>

            <div class="wallet-section">
                <div id="wallet-status">Click "Connect Wallet" to start</div>
                <div id="wallet-address" class="wallet-address" style="display: none;"></div>
            </div>

            <button id="connect-btn" class="send-tip-btn">Connect Wallet</button>

            <div id="tip-form" style="display: none;">
                <input
                    type="number"
                    id="tip-amount"
                    class="tip-amount"
                    placeholder="Custom amount (GAS)"
                    min="0.00000001"
                    step="0.00000001"
                />

                <div class="tip-buttons">
                    <button class="tip-btn" data-amount="0.001">0.001 GAS</button>
                    <button class="tip-btn" data-amount="0.01">0.01 GAS</button>
                    <button class="tip-btn" data-amount="0.1">0.1 GAS</button>
                </div>

                <button id="send-tip-btn" class="send-tip-btn">Send Tip</button>
            </div>

            <div id="status" class="status"></div>
        </div>

        <script>
            // MiniApp SDK will be available when loaded in the platform
            // For local testing, you'll need to use the platform host

            const APP_ID = "com.example.tipjar";
            let userAddress = null;

            // DOM Elements
            const connectBtn = document.getElementById("connect-btn");
            const walletStatus = document.getElementById("wallet-status");
            const walletAddress = document.getElementById("wallet-address");
            const tipForm = document.getElementById("tip-form");
            const tipAmount = document.getElementById("tip-amount");
            const tipButtons = document.querySelectorAll(".tip-btn");
            const sendTipBtn = document.getElementById("send-tip-btn");
            const status = document.getElementById("status");

            // Check if SDK is available
            function checkSDK() {
                if (typeof window.MiniAppSDK === "undefined") {
                    showStatus(
                        "MiniApp SDK not available. Please run this app through the platform host.",
                        "error"
                    );
                    return false;
                }
                return true;
            }

            // Show status message
            function showStatus(message, type) {
                status.textContent = message;
                status.className = `status ${type}`;
            }

            // Connect wallet
            connectBtn.addEventListener("click", async () => {
                if (!checkSDK()) return;

                try {
                    showStatus("Connecting to wallet...", "loading");

                    // Get user's wallet address
                    userAddress = await window.MiniAppSDK.wallet.getAddress();

                    // Update UI
                    walletStatus.style.display = "none";
                    walletAddress.textContent = `Connected: ${userAddress}`;
                    walletAddress.style.display = "block";
                    tipForm.style.display = "block";
                    connectBtn.style.display = "none";

                    showStatus("Wallet connected! You can now send tips.", "success");
                } catch (error) {
                    console.error("Wallet connection failed:", error);
                    showStatus(`Failed to connect: ${error.message}`, "error");
                }
            });

            // Quick amount buttons
            tipButtons.forEach((btn) => {
                btn.addEventListener("click", () => {
                    tipAmount.value = btn.dataset.amount;
                });
            });

            // Convert GAS to satoshis (8 decimals)
            function gasToSatoshis(gas) {
                return Math.floor(parseFloat(gas) * 1e8).toString();
            }

            // Send tip
            sendTipBtn.addEventListener("click", async () => {
                if (!checkSDK() || !userAddress) return;

                const amount = tipAmount.value.trim();
                if (!amount) {
                    showStatus("Please enter an amount", "error");
                    return;
                }

                const amountFloat = parseFloat(amount);
                if (amountFloat <= 0) {
                    showStatus("Amount must be greater than 0", "error");
                    return;
                }

                try {
                    showStatus("Creating payment request...", "loading");
                    sendTipBtn.disabled = true;

                    // Request payment through SDK
                    const intent = await window.MiniAppSDK.payments.payGAS(
                        APP_ID,
                        gasToSatoshis(amount),
                        `tip from ${userAddress.slice(0, 8)}...`
                    );

                    showStatus("Please confirm the transaction in NeoLine...", "loading");

                    // Invoke the transaction (signs and submits)
                    const result = await window.MiniAppSDK.wallet.invokeIntent(intent.request_id);

                    // Success!
                    showStatus(`✓ Tip sent! TX: ${result.tx_id?.slice(0, 16)}...`, "success");

                    // Reset form
                    tipAmount.value = "";
                } catch (error) {
                    console.error("Payment failed:", error);

                    // Handle common errors
                    if (error.message?.includes("User rejected")) {
                        showStatus("Transaction was cancelled", "error");
                    } else if (error.message?.includes("Insufficient")) {
                        showStatus("Insufficient GAS balance", "error");
                    } else {
                        showStatus(`Payment failed: ${error.message}`, "error");
                    }
                } finally {
                    sendTipBtn.disabled = false;
                }
            });
        </script>
    </body>
</html>
```

This creates a complete, working MiniApp with:

- Wallet connection button
- Quick amount selection
- Custom amount input
- Payment processing
- Success/error feedback

## Step 3: Test Locally

To test your MiniApp before deploying:

1. **Start the platform host locally:**

    ```bash
    cd platform/host-app
    npm install
    npm run dev
    ```

2. **Configure local app override:**
    - Add your local `tip-jar-miniapp` directory to the host's local app configuration
    - Access via: `http://localhost:3000/local/tip-jar-miniapp`

3. **Test the flow:**
    - Click "Connect Wallet"
    - Approve in NeoLine
    - Enter an amount (try 0.001)
    - Click "Send Tip"
    - Confirm transaction in NeoLine
    - See success message with TX hash

**Testing Checklist:**

- [ ] Wallet connects and shows address
- [ ] Quick amount buttons populate the input
- [ ] Payment creates intent successfully
- [ ] NeoLine prompts for signature
- [ ] Success message shows TX hash
- [ ] Error handling works (try rejecting a transaction)

## Step 4: Prepare for Deployment

### Create App Assets

You'll need two images:

**Icon (256x256 PNG):**

- Create or generate a simple icon
- Save as `assets/icon.png`
- Tip: Use [Canva](https://www.canva.com) or [Figma](https://www.figma.com)

**Banner (1200x630 PNG):**

- Create a promotional banner
- Save as `assets/banner.png`
- Tip: Include your app name and a tagline

### Update manifest.json

Replace the placeholder URLs with your actual hosting URLs:

```json
{
    "icon": "https://your-cdn.com/tip-jar/assets/icon.png",
    "banner": "https://your-cdn.com/tip-jar/assets/banner.png",
    "entry_url": "https://your-cdn.com/tip-jar/"
}
```

## Step 5: Deploy to Platform

### 1. Upload Your Bundle

Upload your `tip-jar-miniapp` folder to a CDN:

- **Options:** AWS S3, CloudFlare R2, Vercel, GitHub Pages
- **Make sure:** `index.html` is at the root level
- **Note the URL:** You'll need it for the manifest

### 2. Update Your Manifest

Update `manifest.json` with your CDN URL:

```json
{
    "entry_url": "https://your-actual-cdn-url.com/tip-jar/"
}
```

### 3. Register Your MiniApp

Use the platform's registration endpoint:

```bash
curl -X POST https://your-platform.com/functions/v1/app-register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": $(cat manifest.json),
    "chain_id": "neo-n3-testnet"
  }'
```

### 4. Wait for Approval

Your MiniApp status will be **pending_review**. Platform admins will review it.

**Check your status:**

```bash
curl -X GET "https://your-platform.com/functions/v1/app-status?app_id=com.example.tipjar" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Once approved, your status becomes **approved** and your MiniApp is live!

## Full Code Reference

The complete code for this tutorial is available at:

- `https://github.com/r3e-network/miniapps/tree/main/apps/dev-tipping` - Production example
- `docs/tutorials/01-payment-miniapp/code/final/` - Tutorial solution

## Troubleshooting

### "SDK not available" Error

**Cause:** Your app is not running within the MiniApp host iframe.

**Solution:** Test through the platform host, not directly in a browser.

### Payment Fails

**Cause:** User doesn't have enough GAS, or payment was rejected.

**Solution:** Ensure users have testnet GAS and approve the transaction in NeoLine.

### Transaction Stuck

**Cause:** Network congestion or RPC issues.

**Solution:** Wait a few minutes and check transaction status on a block explorer.

## Next Steps

Now that you've built your first payment MiniApp:

**Tutorial 2:** [Build a Provably Fair Game](../02-provably-fair-game/) - Learn to use randomness for gaming

**Tutorial 3:** [Build a Governance Voting App](../03-governance-voting/) - Learn on-chain voting

**Advanced Topics:**

- [SDK API Documentation](../../API_DOCUMENTATION.md)
- [Manifest Specification](../../manifest-spec.md)
- [Platform Workflows](../../WORKFLOWS.md)
