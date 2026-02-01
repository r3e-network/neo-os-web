# MiniApp Platform Auto-Submission and Update Workflow

This document describes how to implement automatic submission and updating workflow for miniapps on the R3E Network platform.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Auto-Submission Workflow](#auto-submission-workflow)
4. [GitHub Webhook Configuration](#github-webhook-configuration)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Configuration Guide](#configuration-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The miniapp platform supports two submission workflows:

| Workflow | Use Case | Process |
|----------|----------|---------|
| **Manual** | External developers | Submit → Review → Build → Publish |
| **Auto-Sync** | Official/Internal miniapps | Git Push → Webhook → Build → Auto-Publish |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MiniApp Platform                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ GitHub Repo  │───►│  Webhook     │───►│ miniapp-internal-    │  │
│  │ (Official)   │    │  Receiver    │    │ sync Function        │  │
│  └──────────────┘    └──────────────┘    └──────────┬───────────┘  │
│                                                      │              │
│                                                      ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ User Browse  │◄───│ Registry     │◄───│ miniapp-registry-    │  │
│  │ App Store    │    │ API          │    │ api Function         │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ MiniApp      │◄───│ Container    │◄───│ miniapp-stats        │  │
│  │ (iFrame)     │    │ Page         │    │ Function             │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Cloudflare R2 CDN                       │   │
│  │  miniapps/{app_id}/{git_commit_sha}/index.html              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Auto-Submission Workflow

### Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Developer Push to GitHub                                                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  GitHub sends webhook to:                                                │
│  https://{project}.supabase.co/functions/v1/miniapp-internal-webhook     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  miniapp-internal-webhook                                                │
│  ├── Verify webhook signature                                            │
│  ├── Match branch (e.g., main/master)                                    │
│  └── Trigger: miniapp-internal-sync RPC or function                      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  miniapp-internal-sync Function                                          │
│  ├── Clone repository (shallow clone)                                    │
│  ├── For each active miniapp in miniapp_internal table:                  │
│  │   ├── Detect manifest.json                                            │
│  │   ├── Detect build config (package.json, vite.config.ts, etc.)        │
│  │   ├── Run: npm install && npm run build                               │
│  │   ├── Upload dist/ to R2 CDN:                                         │
│  │   │   miniapps/{app_id}/{git_commit_sha}/                             │
│  │   └── Update miniapp_internal entry_url                               │
│  │                                                                        │
│  └── If auto_publish=true:                                               │
│      ├── Create version record in miniapp_versions                       │
│      ├── Set as current version                                          │
│      └── Update miniapp_registry status to "active"                      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  R2 CDN                                                                  │
│  URL Format: {CDN_BASE_URL}/miniapps/{app_id}/{commit_sha}/index.html   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  User Access                                                             │
│  1. GET /miniapp-registry-api?status=active                              │
│  2. Get entry_url from response                                          │
│  3. Open /container?appId={app_id}                                       │
│  4. Container loads iframe with entry_url                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Process

#### Step 1: Developer Push Code
```bash
cd /path/to/miniapp
git add .
git commit -m "Update features"
git push origin main
```

#### Step 2: GitHub Sends Webhook
GitHub automatically sends a webhook payload to the configured endpoint.

#### Step 3: Webhook Handler Processes Request
The webhook function:
- Verifies the HMAC-SHA256 signature
- Checks if the push is on the configured branch
- Extracts commit information
- Triggers the sync function

#### Step 4: Sync Function Executes
The sync function:
1. **Clones the repository** (shallow clone for speed)
2. **For each configured miniapp**:
   - Reads `manifest.json` for metadata
   - Detects build configuration
   - Installs dependencies
   - Runs build command
   - Uploads to R2 CDN
3. **Auto-publishes** if configured:
   - Creates version record
   - Sets as current version
   - Updates registry status

#### Step 5: CDN Stores Build Artifacts
```
R2 Bucket Structure:
miniapps/
├── lottery/
│   ├── abc123def/
│   │   ├── index.html
│   │   ├── static/
│   │   │   ├── js/
│   │   │   └── css/
│   │   └── assets/
│   └── bcd234efg/
│       └── ...
├── staking/
│   └── ...
└── ...
```

#### Step 6: Users Access the MiniApp
```typescript
// Frontend: Get published apps
const response = await fetch('/functions/v1/miniapp-registry-api?status=active');
const { data } = await response.json();
// data.items contains apps with entry_url

// Open miniapp
window.location.href = `/container?appId=${appId}`;
```

---

## GitHub Webhook Configuration

### Step 1: Create Webhook in GitHub Repository

1. Go to repository **Settings** → **Webhooks** → **Add webhook**
2. Configure:
   - **Payload URL**: `https://{project-ref}.supabase.co/functions/v1/miniapp-internal-webhook`
   - **Content type**: `application/json`
   - **Secret**: Generate a secure random string
   - **Events**: Select "Just the push event"

### Step 2: Configure Webhook in Database

Insert webhook configuration into the database:

```sql
INSERT INTO miniapp_internal_webhooks (
    name,
    git_url,
    branch,
    subfolder,
    secret,
    is_active,
    auto_publish,
    created_by
) VALUES (
    'Official MiniApps Sync',
    'https://github.com/R3E-Network/neo-miniapps-platform.git',
    'main',
    'miniapps',
    'your-webhook-secret-here',
    true,
    true,
    'your-user-id'
);
```

### Step 3: Configure MiniApps

Insert miniapp configurations:

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
    'lottery',
    'R3E Lottery',
    'https://github.com/R3E-Network/neo-miniapps-platform.git',
    'miniapps/lottery',
    'main',
    'active',
    '{
        "name": "R3E Lottery",
        "description": "Official R3E Lottery MiniApp",
        "category": "gaming",
        "permissions": {"wallet": true}
    }'::jsonb
);
```

---

## API Endpoints

### Webhook Endpoint

```
POST /functions/v1/miniapp-internal-webhook
```

**Headers:**
```
X-GitHub-Event: push
X-Hub-Signature-256: sha256={signature}
Content-Type: application/json
```

**Request Body (from GitHub):**
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "R3E-Network/neo-miniapps-platform"
  },
  "commits": [
    {
      "id": "abc123...",
      "message": "Update lottery features"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Sync triggered",
    "branch": "main",
    "commit": "abc123...",
    "auto_published": true
  }
}
```

### Manual Sync Endpoint

```
POST /functions/v1/miniapp-internal-sync
```

**Request Body:**
```json
{
  "app_id": "lottery",           // Optional: sync specific app
  "git_url": "https://github.com/...",  // Optional: override git URL
  "branch": "main",              // Optional: override branch
  "subfolder": "miniapps",       // Optional: override subfolder
  "auto_publish": true           // Default: true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "synced": 2,
    "commit": "abc123def",
    "commit_message": "Update lottery features",
    "apps": [
      {
        "app_id": "lottery",
        "entry_url": "https://cdn.example.com/miniapps/lottery/abc123def/index.html",
        "version": "abc123def"
      },
      {
        "app_id": "staking",
        "entry_url": "https://cdn.example.com/miniapps/staking/abc123def/index.html",
        "version": "abc123def"
      }
    ],
    "auto_published": true
  }
}
```

### Registry API

```
GET /functions/v1/miniapp-registry-api
```

**Query Parameters:**
- `status`: Filter by status (default: `active`)
- `category`: Filter by category
- `search`: Search by app_id or name
- `limit`: Pagination limit (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "app_id": "lottery",
        "name": "R3E Lottery",
        "current_entry_url": "https://cdn.example.com/miniapps/lottery/abc123def/index.html",
        "current_version_name": "abc123def",
        "lifecycle_status": "active"
      }
    ],
    "pagination": {
      "total": 10,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}
```

### Stats API

```
GET /functions/v1/miniapp-stats?app_id=lottery
```

**Response:**
```json
{
  "app_id": "lottery",
  "name": "R3E Lottery",
  "entry_url": "https://cdn.example.com/miniapps/lottery/abc123def/index.html",
  "category": "gaming",
  "chain_id": "neo-n3-testnet",
  ...
}
```

---

## Database Schema

### Tables

#### miniapp_internal

Stores configuration for internal/official miniapps.

```sql
CREATE TABLE miniapp_internal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    git_url TEXT NOT NULL,
    subfolder TEXT,
    branch VARCHAR(64) DEFAULT 'main',
    manifest JSONB,
    entry_url TEXT,
    git_commit_sha VARCHAR(40),
    current_version VARCHAR(64),
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### miniapp_internal_webhooks

Webhook configurations for auto-sync.

```sql
CREATE TABLE miniapp_internal_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    git_url TEXT NOT NULL,
    branch VARCHAR(64) DEFAULT 'main',
    subfolder TEXT,
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    auto_publish BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    last_status TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### miniapp_internal_sync_history

Sync history for auditing.

```sql
CREATE TABLE miniapp_internal_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(64) NOT NULL,
    git_commit_sha VARCHAR(40) NOT NULL,
    git_commit_message TEXT,
    entry_url TEXT NOT NULL,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    synced_by UUID REFERENCES auth.users(id),
    auto_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### miniapp_versions

Version history for published miniapps.

```sql
CREATE TABLE miniapp_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_id UUID REFERENCES miniapp_registry(id) ON DELETE CASCADE,
    version VARCHAR(64) NOT NULL,
    version_code INTEGER NOT NULL,
    git_commit_sha VARCHAR(40) NOT NULL,
    entry_url TEXT NOT NULL,
    cdn_base_url TEXT,
    cdn_version_path TEXT,
    status TEXT DEFAULT 'draft',
    is_current BOOLEAN DEFAULT FALSE,
    is_forced_update BOOLEAN DEFAULT FALSE,
    published_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### miniapp_registry

Master registry of all miniapps.

```sql
CREATE TABLE miniapp_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255),
    description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    category VARCHAR(64),
    current_version_id UUID REFERENCES miniapp_versions(id),
    lifecycle_status TEXT DEFAULT 'draft',
    manifest JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### miniapp_registry_view

Unified view for querying published miniapps.

```sql
CREATE VIEW miniapp_registry_view AS
SELECT
    r.*,
    v.version AS current_version_name,
    v.version_code AS current_version_code,
    v.entry_url AS current_entry_url,
    v.published_at AS current_published_at
FROM miniapp_registry r
LEFT JOIN miniapp_versions v ON r.current_version_id = v.id
WHERE r.lifecycle_status IN ('active', 'draft');
```

---

## Configuration Guide

### Environment Variables

Required for CDN operations:

```bash
# CDN Configuration
CDN_BASE_URL=https://your-cdn.cloudflarestorage.com
CDN_PROVIDER=r2

# R2/S3 Credentials (S3-compatible API)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=***REMOVED***
AWS_REGION=auto

# R2 Account
R2_ACCOUNT_ID=your_account_id
R2_BUCKET=miniapps
```

### MiniApp Manifest Format

Each miniapp must have a `manifest.json` in its root directory:

```json
{
  "name": "My MiniApp",
  "description": "Description of my miniapp",
  "short_description": "Short description",
  "category": "gaming",
  "version": "1.0.0",
  "entry": "index.html",
  "permissions": {
    "wallet": true,
    "notifications": false
  },
  "supported_chains": ["neo-n3-testnet", "neo-n3-mainnet"],
  "chain_contracts": {
    "neo-n3-testnet": {
      "example": "0x123..."
    }
  },
  "features": {
    "news_integration": false
  },
  "limits": {
    "max_requests_per_minute": 60
  }
}
```

### Build Configuration Detection

The sync function automatically detects build configuration:

1. **Vite Project**: `vite.config.ts`
2. **Next.js Project**: `next.config.js`
3. **Create React App**: Uses default build
4. **Custom**: Checks `package.json` for `build` script

**Expected package.json:**
```json
{
  "scripts": {
    "install": "npm install",
    "build": "npm run build",
    "dev": "npm run dev"
  }
}
```

### Output Directory

Build output should be in one of:
- `dist/` (Vite default)
- `build/` (CRA default)
- `.output/` (Nuxt default)
- Custom configured via `build_config` in database

---

## Troubleshooting

### Webhook Not Triggering

1. **Check webhook URL is correct**
   ```bash
   # Verify the endpoint is accessible
   curl -X POST https://your-project.supabase.co/functions/v1/miniapp-internal-webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. **Verify webhook signature**
   ```sql
   -- Check webhook secret in database
   SELECT secret FROM miniapp_internal_webhooks WHERE is_active = true;
   ```

3. **Check GitHub webhook delivery history**
   - Go to repository Settings → Webhooks
   - View recent deliveries

### Build Failures

1. **Check sync history**
   ```sql
   SELECT * FROM miniapp_internal_sync_history 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

2. **Common issues:**
   - Missing dependencies in `package.json`
   - Incorrect build command
   - Large file sizes (> 50MB)

3. **Manual test**
   ```bash
   # Clone and build manually
   git clone --depth 1 your-repo-url
   cd your-subfolder
   npm install
   npm run build
   ```

### CDN Upload Failures

1. **Verify R2 credentials**
   ```bash
   # Test R2 connection
   aws s3 ls --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \
     --access-key-id $AWS_ACCESS_KEY_ID \
     --secret-access-key $AWS_SECRET_ACCESS_KEY \
     --bucket miniapps
   ```

2. **Check CORS configuration**
   - R2 bucket must allow CORS for iframe embedding

3. **Verify public access**
   - CDN URL should be publicly accessible
   - Test in incognito browser

### MiniApp Not Loading

1. **Verify entry_url format**
   ```sql
   SELECT app_id, current_entry_url 
   FROM miniapp_registry_view 
   WHERE app_id = 'your-app-id';
   ```

2. **Check CDN URL accessibility**
   ```bash
   curl -I https://cdn.example.com/miniapps/your-app-id/latest/index.html
   ```

3. **Verify status in registry**
   ```sql
   SELECT app_id, lifecycle_status, current_entry_url 
   FROM miniapp_registry_view 
   WHERE app_id = 'your-app-id';
   ```

### Debug Mode

Enable debug logging in the sync function:

```sql
-- No built-in debug, check Supabase function logs:
-- Dashboard → Functions → miniapp-internal-sync → Logs
```

---

## Best Practices

### 1. Version Control
- Use semantic versioning for releases
- Tag releases in GitHub
- Include changelog in commit messages

### 2. Build Optimization
- Minimize bundle size (< 2MB recommended)
- Use code splitting
- Compress images

### 3. Security
- Rotate webhook secrets periodically
- Use HTTPS for all endpoints
- Validate manifest.json before publishing

### 4. Monitoring
- Monitor sync history for failures
- Set up alerts for build failures
- Track CDN bandwidth usage

---

## Support

For issues:
1. Check Supabase Function logs
2. Review sync history in database
3. Test manually with `miniapp-internal-sync` endpoint
