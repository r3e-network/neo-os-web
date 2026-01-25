# R3E Network Official MiniApps Auto-Update Guide

This document describes how the official R3E MiniApps repository automatically builds and deploys to the CDN when code is pushed.

## Quick Start

```bash
# 1. Make changes to a miniapp in miniapps/{app_id}/
# 2. Commit and push
git add miniapps/lottery/
git commit -m "Update lottery features"
git push origin main

# 3. That's it! The webhook will automatically:
#    - Build the miniapp
#    - Upload to R2 CDN
#    - Auto-publish the new version
```

---

## Repository Structure

```
service_layer/
├── miniapps/
│   ├── lottery/           # MiniApp: R3E Lottery
│   │   ├── manifest.json  # MiniApp metadata
│   │   ├── index.html     # Entry point
│   │   ├── src/           # Source code
│   │   ├── package.json   # Dependencies & build scripts
│   │   └── vite.config.ts # Build configuration
│   │
│   ├── staking/           # MiniApp: R3E Staking
│   │   ├── manifest.json
│   │   └── ...
│   │
│   └── ...
│
└── docs/
    └── MINIAPP_AUTO_SUBMISSION.md  # This document
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  Developer: git push to main branch                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GitHub sends webhook to:                                           │
│  https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/             │
│  miniapp-internal-webhook                                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  miniapp-internal-webhook                                           │
│  ├── Verify HMAC signature                                          │
│  ├── Extract commit SHA and message                                 │
│  └── Trigger miniapp-internal-sync                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  miniapp-internal-sync                                              │
│  ├── Clone service_layer repo (shallow)                             │
│  ├── For each miniapp in miniapps/:                                 │
│  │   ├── Read manifest.json                                         │
│  │   ├── Detect build config                                        │
│  │   ├── npm install && npm run build                               │
│  │   ├── Upload dist/ to R2:                                        │
│  │   │   miniapps/{app_id}/{commit_sha}/                            │
│  │   └── Create version record                                      │
│  │                                                                   │
│  └── Update miniapp_registry.current_version_id                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  R2 CDN Storage                                                     │
│  URL: {CDN_BASE_URL}/miniapps/{app_id}/{commit_sha}/index.html     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Users access via:                                                  │
│  1. GET /functions/v1/miniapp-registry-api?status=active            │
│  2. Open /container?appId={app_id}                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Adding a New Official MiniApp

### Step 1: Create MiniApp Directory

```bash
mkdir -p miniapps/new-app
cd miniapps/new-app
```

### Step 2: Create manifest.json

```json
{
  "name": "New App Name",
  "description": "Description of your miniapp",
  "short_description": "Short description",
  "category": "gaming",
  "version": "1.0.0",
  "permissions": {
    "wallet": true
  },
  "supported_chains": ["neo-x-testnet", "neo-x-mainnet"],
  "chain_contracts": {}
}
```

### Step 3: Create package.json

```json
{
  "name": "r3e-new-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### Step 4: Create Entry File

`index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Step 5: Configure Vite

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
})
```

### Step 6: Add to Database

```sql
INSERT INTO miniapp_internal (
    app_id,
    name,
    git_url,
    subfolder,
    branch,
    status,
    manifest
) VALUES (
    'new-app',
    'New App Name',
    'https://github.com/R3E-Network/service_layer.git',
    'miniapps/new-app',
    'main',
    'active',
    '{
        "name": "New App Name",
        "description": "Description",
        "category": "gaming"
    }'::jsonb
);
```

### Step 7: Add to Registry

```sql
INSERT INTO miniapp_registry (
    app_id,
    name,
    category,
    lifecycle_status,
    manifest
) VALUES (
    'new-app',
    'New App Name',
    'gaming',
    'draft',
    '{
        "name": "New App Name",
        "description": "Description"
    }'::jsonb
);
```

### Step 8: Commit and Push

```bash
cd /path/to/service_layer
git add miniapps/new-app/
git commit -m "Add new-app miniapp"
git push origin main
```

The webhook will automatically build and deploy!

---

## GitHub Webhook Configuration

The webhook is already configured. Here's the configuration:

**Endpoint:**
```
https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-internal-webhook
```

**Events:** Push to `main` branch

**To modify webhook settings:**
```sql
-- View current webhook
SELECT * FROM miniapp_internal_webhooks;

-- Update webhook
UPDATE miniapp_internal_webhooks
SET auto_publish = true,
    branch = 'main'
WHERE is_active = true;
```

---

## CDN URL Format

After build, your miniapp will be available at:

```
{CDN_BASE_URL}/miniapps/{app_id}/{git_commit_sha}/index.html
```

Example:
```
https://bf0d7e814f69945157f30505e9fba9fe.r2.cloudflarestorage.com/miniapps/lottery/abc123def/index.html
```

---

## Manual Sync

If you need to trigger a build manually:

```bash
curl -X POST "https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-internal-sync" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "lottery",
    "auto_publish": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "synced": 1,
    "commit": "abc123def",
    "apps": [
      {
        "app_id": "lottery",
        "entry_url": "https://.../miniapps/lottery/abc123def/index.html",
        "version": "abc123def"
      }
    ],
    "auto_published": true
  }
}
```

---

## Checking Sync Status

```sql
-- View sync history
SELECT app_id, git_commit_sha, status, created_at
FROM miniapp_internal_sync_history
ORDER BY created_at DESC
LIMIT 20;

-- View current versions
SELECT r.app_id, r.name, v.version, v.entry_url, v.published_at
FROM miniapp_registry r
LEFT JOIN miniapp_versions v ON r.current_version_id = v.id
WHERE r.lifecycle_status = 'active';
```

---

## Troubleshooting

### Build Fails

Check the function logs:
```bash
# Via Supabase Dashboard
# Functions → miniapp-internal-sync → Logs
```

Common issues:
- Missing dependencies in `package.json`
- Build command not found
- TypeScript errors

### Webhook Not Triggering

1. Check GitHub webhook delivery history
2. Verify webhook is active:
   ```sql
   SELECT is_active, branch FROM miniapp_internal_webhooks;
   ```
3. Test manually with curl

### MiniApp Not Loading

1. Check if version was published:
   ```sql
   SELECT app_id, lifecycle_status, current_entry_url 
   FROM miniapp_registry 
   WHERE app_id = 'your-app';
   ```

2. Verify CDN URL is accessible:
   ```bash
   curl -I "https://.../miniapps/your-app/latest/index.html"
   ```

---

## Best Practices

### 1. Manifest Updates
Always update `manifest.json` when:
- Changing app name or description
- Updating permissions
- Adding new chain support

### 2. Version Bumping
For major releases, update `version` in manifest.json:
```json
{
  "version": "1.1.0"
}
```

### 3. Commit Messages
Use descriptive commit messages:
```
lottery: fix wallet connection issue
staking: add new pool
dashboard: update UI theme
```

### 4. Testing
Before pushing to main:
```bash
cd miniapps/lottery
npm install
npm run build
# Verify dist/ folder contains index.html
```

---

## Current Official MiniApps

| App ID | Name | Category | Status |
|--------|------|----------|--------|
| lottery | R3E Lottery | gaming | active |
| staking | R3E Staking | defi | active |

To add a new official miniapp, follow the steps in [Adding a New Official MiniApp](#adding-a-new-official-miniapp).

---

## Support

For issues:
1. Check Supabase Function logs (Dashboard → Functions → miniapp-internal-sync)
2. Check sync history in database
3. Test manual sync to see detailed errors
