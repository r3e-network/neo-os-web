# Miniapps Integration Guide

## Overview

This repository contains standalone miniapps that are built and deployed as static HTML files. The platform is responsible for discovering, loading, and hosting these miniapps.

## Quick Start

```bash
# 1. Build all miniapps
pnpm build:all

# 2. Generate miniapps registry
node scripts/auto-discover-miniapps.js

# 3. Deploy miniapps and registry to platform
```

## Scaffold Template Presets

New miniapps created with `node scripts/create-miniapp.mjs` now generate `src/pages/index/index.vue` from shared preset utilities instead of inline template objects.

- Preset definitions live in `miniapps/shared/utils/templatePresets.ts`.
- Generated pages call `createTemplateConfigFromPreset(...)` from `@shared/utils`.
- Generated pages render `MiniAppShell` (shared wrapper over `MiniAppTemplate` + `ErrorBoundary`).
- Shared `createTemplateConfig(...)` still auto-appends the docs tab and standard feature flags.
- `templateType: custom` remains supported and resolves to the shared `custom` preset.
- Shared stats wrappers (`MiniAppOperationStats`, `MiniAppTabStats`) should be used for repeated `NeoCard + NeoStats` blocks.
- `scripts/validate-miniapps.mjs` enforces shared-template usage (`MiniAppTemplate` or `MiniAppShell`) and shared template-config imports.

This keeps scaffold output aligned with the platform template contract while allowing future preset changes in one place.

## Directory Structure

```
miniapps/
├── apps/                    # Source miniapps
│   ├── lottery/            # Individual miniapp
│   │   ├── src/
│   │   ├── neo-manifest.json
│   │   └── package.json
│   └── ...
├── public/miniapps/         # Built artifacts (deployed)
│   ├── lottery/
│   │   ├── index.html
│   │   └── static/
│   └── ...
├── scripts/
│   └── auto-discover-miniapps.js  # Registry generator
├── platform/host-app/
│   └── data/
│       └── miniapps.json         # Generated registry
└── shared/                   # Shared components
```

## Build Process

### 1. Build All Miniapps

```bash
pnpm build:all
```

This script:

1. Generates app templates from `scripts/app-config.js`
2. Runs `turbo build` for all miniapps
3. Copies build outputs to `public/miniapps/[app-name]/`

**Build Output:**

- Source: `apps/[app-name]/src/`
- Build: `apps/[app-name]/dist/build/h5/`
- Deploy: `public/miniapps/[app-name]/`

### 2. Generate Registry

```bash
node scripts/auto-discover-miniapps.js
```

**Output:** `platform/host-app/data/miniapps.json`

This script scans `apps/` directory and creates a categorized registry of all miniapps.

## Registry Format

### Output Structure

```json
{
  "gaming": [
    {
      "app_id": "miniapp-lottery",
      "name": "Lottery",
      "name_zh": "抽奖",
      "description": "Try your luck with daily lottery",
      "description_zh": "每日抽奖试试手气",
      "icon": "/miniapps/lottery/static/logo.jpg",
      "banner": "/miniapps/lottery/static/banner.jpg",
      "entry_url": "/miniapps/lottery/index.html",
      "category": "gaming",
      "status": "active",
      "supportedChains": ["neo-n3-testnet", "neo-n3-mainnet"],
      "chainContracts": {
        "neo-n3-testnet": {
          "address": "0x...",
          "active": true
        }
      },
      "permissions": {
        "payments": true,
        "governance": false,
        "rng": false,
        "datafeed": false,
        "automation": false,
        "confidential": false
      }
    }
  ],
  "defi": [...],
  "social": [...],
  "nft": [...],
  "governance": [...],
  "utility": [...]
}
```

### Categories

| Category     | Description         | Pattern Detection                     |
| ------------ | ------------------- | ------------------------------------- |
| `gaming`     | Casino and games    | lottery, coin-flip, dice, tarot, etc. |
| `defi`       | Financial protocols | swap, loan, vault, compound, etc.     |
| `social`     | Social interactions | envelope, tipping, breakup, etc.      |
| `nft`        | NFT related         | garden, graveyard, heritage, etc.     |
| `governance` | DAO and voting      | governance, vote, dao, council, etc.  |
| `utility`    | Tools and utilities | explorer, ns, checkin, etc.           |

## Platform Integration

### Option 1: Static Hosting (Current)

The platform serves miniapps as static files:

```
Platform Server
├── /data/miniapps.json     ← Registry (API endpoint)
└── /miniapps/
    ├── lottery/index.html    ← Built miniapp
    ├── coin-flip/index.html
    └── ...
```

**Loading a Miniapp:**

1. Fetch `/data/miniapps.json`
2. Find app by `app_id`
3. Create iframe pointing to `entry_url`
4. Load with permissions check

### Option 2: Dynamic Registry (Recommended)

Platform provides registry via API:

```typescript
// GET /api/miniapps
interface MiniappsResponse {
    gaming: MiniAppManifest[];
    defi: MiniAppManifest[];
    // ...
}

// GET /api/miniapps/:appId
interface MiniappResponse {
    manifest: MiniAppManifest;
    entryUrl: string;
    permissions: PermissionCheckResult;
}
```

### Option 3: Hybrid Approach

Platform hosts miniapps but provides additional runtime services:

- **Wallet Integration** - Inject wallet SDK into iframe
- **Chain Detection** - Auto-switch based on user's network
- **Payment Processing** - Handle payments before miniapp loads
- **Analytics** - Track usage across all miniapps

## Manifest Format

### neo-manifest.json

Each miniapp can have a `neo-manifest.json` in its root:

```json
{
  "app_id": "miniapp-lottery",
  "name": "Lottery",
  "name_zh": "抽奖",
  "description": "Daily lottery with prizes",
  "description_zh": "每日抽奖赢取奖励",
  "icon": "/miniapps/lottery/static/logo.jpg",
  "banner": "/miniapps/lottery/static/banner.jpg",
  "entry_url": "/miniapps/lottery/index.html",
  "category": "gaming",
  "status": "active" | "inactive" | "deprecated",
  "supported_chains": ["neo-n3-testnet", "neo-n3-mainnet"],
  "contracts": {
    "neo-n3-testnet": {
      "address": "0x...",
      "active": true,
      "entry_url": "/miniapps/lottery/index.html?chain=testnet"
    }
  },
  "permissions": ["payments", "governance"],
  "limits": {
    "daily_calls": 100,
    "max_amount": "100000000"
  }
}
```

### Priority Order for Metadata

The auto-discovery script resolves metadata in this order:

1. **`neo-manifest.json`** (root of app folder) - Source of truth
2. **`src/manifest.json`** - Fallback for basic info
3. **`package.json`** - Last resort for name/appId

## Contract Addresses

### Auto-Discovery from Deploy Configs

The script automatically resolves contract addresses from:

```
deploy/config/
├── testnet_contracts.json   ← neo-n3-testnet addresses
└── mainnet_contracts.json   ← neo-n3-mainnet addresses
```

**Format:**

```json
{
    "miniapp_contracts": [
        {
            "app_id": "miniapp-lottery",
            "address": "0x8db1b8c67b52e02592d2ee7ceb47dea908ab0e46",
            "network": "neo-n3-testnet"
        }
    ]
}
```

### Platform Contract Resolution

The platform can:

1. **Read from registry** - Use `chainContracts` field from miniapps.json
2. **Resolve dynamically** - Query contract configs based on `app_id`
3. **Cache addresses** - Store resolved addresses for performance

```typescript
// Example: Get contract address for an app
function getAppContract(appId: string, chainId: string): string | null {
    // From registry
    const app = registry.find((a) => a.app_id === appId);
    const contract = app?.chainContracts?.[chainId]?.address;

    // Or from deploy config
    if (!contract) {
        const config = await loadContractConfig(chainId);
        contract = config?.miniapp_contracts?.find(
            (c) => c.app_id === appId,
        )?.address;
    }

    return contract;
}
```

## Platform Update Checklist

When updating the platform to support new miniapps:

### Build Integration

- [ ] Add `pnpm build:all` to CI/CD pipeline
- [ ] Copy `public/miniapps/` to static hosting
- [ ] Deploy `data/miniapps.json` as API endpoint

### Registry API

- [ ] Create GET `/api/miniapps` endpoint
- [ ] Create GET `/api/miniapps/:appId` endpoint
- [ ] Add category filtering query params
- [ ] Add search functionality

### Miniapp Loader

- [ ] Implement iframe-based loader
- [ ] Add sandbox permissions
- [ ] Implement postMessage communication
- [ ] Add timeout and error handling

### Permission System

- [ ] Request permissions before loading
- [ ] Store user-granted permissions
- [ ] Validate permissions at runtime
- [ ] Handle permission denial gracefully

### Contract Integration

- [ ] Resolve contract addresses from registry
- [ ] Inject contract addresses into miniapp context
- [ ] Handle multi-chain scenarios
- [ ] Switch contract based on active chain

## Theme Integration

Miniapps support theme CSS variables. The platform can:

### 1. Set Theme via Data Attribute

```html
<html data-theme="dark">
    <!-- Miniapp loads with dark theme -->
</html>
```

### 2. Pass Theme via URL

```html
<iframe src="/miniapps/lottery/index.html?theme=dark"></iframe>
```

### 3. PostMessage Theme

```javascript
// Platform sends theme to miniapp
iframe.contentWindow.postMessage(
    {
        type: "theme-change",
        theme: "dark",
    },
    "*",
);
```

## Deployment Workflow

### Development Workflow

```bash
# 1. Make changes to miniapp(s)
cd apps/lottery
pnpm dev

# 2. Build and test
pnpm build

# 3. Generate registry
cd ../..
node scripts/auto-discover-miniapps.js

# 4. Test in platform
cd platform/host-app
pnpm dev
```

### Production Deployment

```bash
# 1. Build all miniapps
pnpm build:all

# 2. Generate registry
node scripts/auto-discover-miniapps.js

# 3. Deploy to platform
# - Copy public/miniapps/* to platform CDN
# - Deploy platform/host-app/data/miniapps.json to API
```

### CI/CD Pipeline Example

```yaml
# .github/workflows/deploy.yml
name: Deploy Miniapps

on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Setup Node.js
              uses: actions/setup-node@v3
              with:
                  node-version: 20

            - name: Install pnpm
              run: npm install -g pnpm@latest

            - name: Install dependencies
              run: pnpm install

            - name: Build all miniapps
              run: pnpm build:all

            - name: Generate registry
              run: node scripts/auto-discover-miniapps.js

            - name: Deploy to platform
              run: |
                  # Deploy miniapps to CDN
                  aws s3 sync public/miniapps/ s3://platform-cdn/miniapps/ --delete

                  # Deploy registry to API
                  curl -X POST $PLATFORM_API/registry \
                    -H "Content-Type: application/json" \
                    -d @platform/host-app/data/miniapps.json
```

## Miniapp Lifecycle

### 1. Discovery

Platform discovers miniapps by:

- Reading `miniapps.json` registry
- Parsing each app's manifest
- Caching for performance

### 2. Validation

Platform validates:

- App status (active/inactive/deprecated)
- Chain support compatibility
- Permission requirements
- Contract address availability

### 3. Loading

Platform loads miniapp by:

1. Checking permissions
2. Creating sandboxed iframe
3. Setting theme and context
4. Injecting wallet/chain data
5. Loading entry URL

### 4. Communication

Platform ↔ Miniapp communication:

```typescript
// Platform → Miniapp
iframe.contentWindow.postMessage(
    {
        type: "init",
        data: { theme, chain, wallet, permissions },
    },
    "*",
);

// Miniapp → Platform
window.addEventListener("message", (event) => {
    if (event.data.type === "payment-request") {
        // Handle payment
    }
});
```

## Testing Integration

### Local Development

```bash
# Terminal 1: Host platform
cd platform/host-app
pnpm dev
# → http://localhost:3000

# Terminal 2: Specific miniapp
cd apps/lottery
pnpm dev
# → Test individual miniapp
```

### Registry Testing

```bash
# Test auto-discovery
node scripts/auto-discover-miniapps.js

# Validate output
cat platform/host-app/data/miniapps.json | jq '.gaming | length'
# Should show number of gaming apps
```

## Troubleshooting

### Miniapp Not Loading

**Check:**

1. `miniapps.json` exists and is valid JSON
2. `entry_url` path is correct
3. Miniapp is built (check `public/miniapps/[app]/index.html`)
4. No console errors in platform or miniapp

### Contract Address Missing

**Check:**

1. App ID matches deploy config (`app_id` vs `miniapp-[app_id]`)
2. Deploy config has entry for the app
3. Network matches supported chains

### Permissions Not Working

**Check:**

1. Platform requests permissions before loading
2. Permission response is sent to miniapp
3. Miniapp handles permission denial

### Theme Not Applying

**Check:**

1. `data-theme` attribute is set on document
2. Miniapp uses CSS variables with fallbacks
3. Platform and miniapp share same styles/tokens

## API Reference

### Registry Endpoints

#### GET /api/miniapps

Get all miniapps, optionally filtered.

**Query Params:**

- `category` - Filter by category
- `status` - Filter by status (active/inactive)
- `chain` - Filter by supported chain
- `search` - Search in name/description

**Response:** `MiniappRegistry`

#### GET /api/miniapps/:appId

Get specific miniapp details.

**Response:** `MiniAppManifest`

#### POST /api/miniapps/:appId/permissions

Request permissions for an app.

**Request:**

```json
{
    "permissions": ["payments", "governance"]
}
```

**Response:**

```json
{
    "allowed": true,
    "denied": []
}
```

### Manifest Interface

```typescript
interface MiniAppManifest {
    app_id: string; // Unique identifier
    name: string; // English name
    name_zh: string; // Chinese name
    description: string; // English description
    description_zh: string; // Chinese description
    icon: string; // Icon URL
    banner: string; // Banner URL
    entry_url: string; // HTML entry point
    category: MiniAppCategory; // Category
    status: "active" | "inactive" | "deprecated";
    supportedChains: string[]; // Supported networks
    chainContracts: {
        // Per-chain contracts
        [chainId: string]: {
            address: string;
            active: boolean;
            entryUrl?: string;
        };
    };
    permissions: {
        // Required permissions
        payments: boolean;
        governance: boolean;
        rng: boolean;
        datafeed: boolean;
        automation: boolean;
        confidential: boolean;
    };
    limits: Record<string, unknown> | null;
    stats_display: Record<string, unknown> | null;
    news_integration: boolean | null;
}

type MiniAppCategory =
    | "gaming"
    | "defi"
    | "social"
    | "nft"
    | "governance"
    | "utility";
```

## Support

For questions about miniapp integration or platform updates:

1. **Build Issues** - Check `scripts/build-all.sh`
2. **Registry Issues** - Check `scripts/auto-discover-miniapps.js`
3. **Manifest Issues** - See `neo-manifest.json` format
4. **Deployment Issues** - Verify paths and permissions
