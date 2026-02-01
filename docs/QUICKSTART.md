# MiniApp Quickstart Guide

This guide will help you create and deploy your first Neo N3 MiniApp from scratch.

## Prerequisites

Before you begin, make sure you have:

- **NeoLine N3 Wallet** - [Download](https://neoline.io/) for browser extension
- **Testnet GAS** - Get testnet GAS from a [faucet](https://neowish.neoline.io/)
- **Node.js 18+** - For building your MiniApp
- **Supabase Account** - Platform authentication (or use platform host)
- **Basic Knowledge** of JavaScript/TypeScript and Vue/React

---

## Step 1: Create Your Manifest

Every MiniApp requires a `manifest.json` file that describes your app to the platform.

Create a new directory for your MiniApp:

```bash
mkdir my-first-miniapp
cd my-first-miniapp
```

Create `manifest.json`:

```json
{
    "app_id": "com.example.myfirstapp",
    "version": "1.0.0",
    "name": "My First MiniApp",
    "description": "A simple example MiniApp",
    "icon": "https://example.com/icon.png",
    "banner": "https://example.com/banner.jpg",
    "category": "utilities",
    "entry_url": "https://cdn.example.com/myfirstapp/",
    "supported_chains": ["neo-n3-testnet"],
    "permissions": {
        "read_address": true,
        "payments": true
    },
    "assets_allowed": ["GAS"],
    "limits": {
        "max_gas_per_tx": "100000000", // 1 GAS
        "daily_gas_cap_per_user": "1000000000" // 10 GAS
    },
    "contracts": {
        "neo-n3-testnet": {
            "address": "",
            "entry_url": ""
        }
    }
}
```

**Key Fields:**

- `app_id`: Unique identifier (reverse domain format recommended)
- `entry_url`: Where your MiniApp bundle is hosted
- `permissions`: Which SDK features your app needs
- `assets_allowed`: Only "GAS" for payments (required if `payments: true`)

---

## Step 2: Build Your MiniApp

Choose your framework:

### Option A: Vue 3 + UniApp (Recommended)

```bash
npm install -g @vue/cli
vue create my-miniapp
cd my-miniapp
```

### Option B: React

```bash
npx create-react-app my-miniapp
cd my-miniapp
```

### Option C: Vanilla HTML/JS

Create a simple `index.html`:

```html
<!DOCTYPE html>
<html>
    <head>
        <title>My First MiniApp</title>
    </head>
    <body>
        <div id="app">
            <h1>Hello, MiniApp!</h1>
            <button onclick="getAddress()">Connect Wallet</button>
            <div id="address"></div>
        </div>

        <script>
            async function getAddress() {
                if (!window.MiniAppSDK) {
                    alert("SDK not available. Run this app within the MiniApp host.");
                    return;
                }

                const address = await window.MiniAppSDK.wallet.getAddress();
                document.getElementById("address").textContent = address;
            }
        </script>
    </body>
</html>
```

---

## Step 3: Use the MiniApp SDK

The MiniApp SDK (`window.MiniAppSDK`) is available when your app is loaded in the host.

### Available Modules

```javascript
// Wallet - Get user's address
const address = await window.MiniAppSDK.wallet.getAddress();

// Payments - Pay GAS
const intent = await window.MiniAppSDK.payments.payGAS(
    "com.example.myfirstapp", // appId
    "100000000", // 0.001 GAS (in satoshis)
    "user-action-memo" // Optional memo
);

// Sign and submit the transaction
const result = await window.MiniAppSDK.wallet.invokeIntent(intent.request_id);

// Randomness - Get provably random numbers
const randomness = await window.MiniAppSDK.rng.request("com.example.myfirstapp");
const randomBytes = randomness.randomness; // hex-encoded

// Data Feed - Get price data
const price = await window.MiniAppSDK.datafeed.getPrice("BTCUSDT");
```

### Example: Simple Payment MiniApp

```javascript
async function buyItem() {
    const amount = "100000000"; // 0.001 GAS in satoshis
    const memo = "buy-item-123";

    try {
        const intent = await window.MiniAppSDK.payments.payGAS(
            "com.example.myfirstapp",
            amount,
            memo
        );

        const result = await window.MiniAppSDK.wallet.invokeIntent(intent.request_id);
        console.log("Payment successful:", result.tx_id);
    } catch (error) {
        console.error("Payment failed:", error);
    }
}
```

---

## Step 4: Register Your MiniApp

Once your app is ready, register it with the platform.

### Option A: Using the Edge Function (Recommended)

1. **Get an API token** from Supabase Auth
2. **Call the registration endpoint**:

```bash
curl -X POST https://your-platform.com/functions/v1/app-register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": $(cat manifest.json),
    "chain_id": "neo-n3-testnet"
  }'
```

**Response:**

```json
{
  "request_id": "uuid",
  "user_id": "your-user-id",
  "intent": "apps",
  "manifest_hash": "0x...",
  "chain_id": "neo-n3-testnet",
  "chain_type": "neo-n3",
  "invocation": {
    "chain_id": "neo-n3-testnet",
    "chain_type": "neo-n3",
    "contract_address": "0x...",
    "method": "registerApp",
    "params": [...]
  }
}
```

3. **Sign and submit the transaction** using the returned `invocation` object

### Option B: Using the Helper Script

```bash
# Set your environment variables
export NEO_TESTNET_WIF=Kx...  # Your wallet WIF
export MINIAPP_MANIFEST_PATH=manifest.json
export MINIAPP_DEVELOPER_PUBKEY=03...  # Your public key

# Run the registration script
go run scripts/register_miniapp_appregistry.go
```

---

## Step 5: Wait for Approval

After registration, your MiniApp status is **Pending**.

**Check your status:**

```bash
curl -X GET "https://your-platform.com/functions/v1/app-status?app_id=com.example.myfirstapp" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
    "app_id": "com.example.myfirstapp",
    "status": "pending", // "pending" | "approved" | "rejected" | "disabled"
    "submitted_at": "2025-01-23T10:00:00Z",
    "updated_at": "2025-01-23T10:00:00Z",
    "name": "My First MiniApp",
    "category": "utilities"
}
```

Platform admins will review your MiniApp. Once approved, the status will change to `approved`.

---

## Step 6: Deploy Your MiniApp

### Upload Your Bundle

1. **Build your app** for production
2. **Upload to CDN** (e.g., AWS S3, CloudFlare, Vercel)
3. **Update your manifest** with the CDN URL:
    ```json
    {
        "entry_url": "https://cdn.example.com/my-miniapp/"
    }
    ```
4. **Call `app-update-manifest`** with the new manifest
5. **Wait for re-approval** (status changes back to pending during updates)

---

## Step 7: Test Your MiniApp

Once approved, test your MiniApp:

1. **Navigate to the platform host** URL
2. **Find your MiniApp** in the app list
3. **Click to launch** it
4. **Test all features** (payments, wallet connection, etc.)

---

## Common Issues

### Issue: "SDK not available"

**Cause:** Your app is not running within the MiniApp host iframe.

**Solution:** Test your app through the platform host, not directly in a browser.

### Issue: "Payment failed"

**Cause:** User doesn't have enough GAS, or payment was rejected.

**Solution:** Ensure users have testnet GAS and approve the transaction in their wallet.

### Issue: "App not approved"

**Cause:** Your MiniApp is still in review, or was rejected.

**Solution:** Check your app status and wait for admin approval. Rejected apps will include a reason.

### Issue: "Invalid manifest"

**Cause:** Manifest validation failed.

**Solution:** Check the manifest specification at `docs/manifest-spec.md` and ensure all required fields are present.

---

## Next Steps

- **Add smart contract logic**: Create a custom contract for game state, governance, etc.
- **Implement randomness**: Use `sdk.rng.requestRandom()` for provably fair games
- **Add notifications**: Use platform notifications for user updates
- **Explore example apps**: Check out the 70+ example MiniApps in `miniapps-uniapp/apps/`

---

## Resources

- [SDK API Documentation](../docs/API_DOCUMENTATION.md)
- [Manifest Specification](../docs/manifest-spec.md)
- [Platform Workflows](../docs/WORKFLOWS.md)
- [Example Apps](../miniapps-uniapp/apps/)

---

## Need Help?

- **Check existing issues**: [GitHub Issues](https://github.com/R3E-Network/neo-miniapps-platform/issues)
- **Ask the community**: [Discord](https://discord.gg/...)
- **Read the docs**: [docs/](../docs/)
