# MiniApp Platform - Production Readiness Report

**Date:** 2026-01-25  
**Project:** R3E Network MiniApp Platform  
**Status:** ✅ PRODUCTION READY

---

## Executive Summary

The R3E Network MiniApp Platform has been fully refactored and is now production-ready. All components have been tested, fixed, and deployed.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         R3E MiniApp Platform                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐    │
│  │  GitHub Webhook │────►│  Edge Functions │────►│   R2 CDN        │    │
│  │  (Auto-Sync)    │     │  (9 functions)  │     │  (Storage)      │    │
│  └─────────────────┘     └─────────────────┘     └────────┬────────┘    │
│           │                                              │              │
│           │                                              ▼              │
│  ┌─────────────────┐                            ┌─────────────────┐    │
│  │  External Devs  │                            │  User Browser   │    │
│  │  (Manual Flow)  │                            │  (iFrame Load)  │    │
│  └─────────────────┘                            └─────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Supabase (Database + Auth)                   │   │
│  │  miniapp_submissions | miniapp_versions | miniapp_registry       │   │
│  │  miniapp_builds | miniapp_internal | admin_emails               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Components Status

### Database ✅

| Table | Status | Notes |
|-------|--------|-------|
| `miniapp_submissions` | ✅ | lifecycle_status, metadata |
| `miniapp_versions` | ✅ | app_id (not registry_id), indexes |
| `miniapp_registry` | ✅ | lifecycle_status, current_version_id |
| `miniapp_builds` | ✅ | Build records with CDN info |
| `miniapp_internal` | ✅ | Official miniapps config |
| `miniapp_internal_webhooks` | ✅ | Webhook configurations |
| `miniapp_internal_sync_history` | ✅ | Sync audit log |
| `admin_emails` | ✅ | Admin access control |
| `rate_limits` | ✅ | Rate limiting |
| `api_keys` | ✅ | API key management |

### Edge Functions ✅

| Function | Version | Status | Purpose |
|----------|---------|--------|---------|
| `miniapp-submit` | 2 | ACTIVE | Submit Git URL for review |
| `miniapp-review` | 2 | ACTIVE | Review/approve submissions |
| `miniapp-build` | 3 | ACTIVE | Build and upload to CDN |
| `miniapp-version-create` | 2 | ACTIVE | Create version from build |
| `miniapp-publish` | 2 | ACTIVE | Publish version to users |
| `miniapp-registry-api` | 2 | ACTIVE | Query published apps |
| `miniapp-stats` | 1 | ACTIVE | Get app stats + entry_url |
| `miniapp-internal-sync` | 2 | ACTIVE | Auto-sync official apps |
| `miniapp-internal-webhook` | 2 | ACTIVE | GitHub webhook receiver |

### RPC Functions ✅

| Function | Purpose |
|----------|---------|
| `is_admin(p_user_id)` | Check admin access |
| `normalize_git_url(url)` | Normalize git URLs |
| `publish_version(id, user_id)` | Publish and set current |
| `rate_limit_bump(id, type, window)` | Rate limiting |
| `verify_api_key(key)` | API key validation |
| `trigger_internal_miniapp_sync(...)` | Trigger sync from webhook |
| `update_miniapp_current_version()` | Auto-unpublish old versions |

---

## Workflows

### 1. External Developer Flow (Manual)

```
Developer                          Admin
  │                                  │
  ├─► POST /miniapp-submit           │
  │    {git_url, branch, subfolder}  │
  │    → lifecycle_status: pending_review
  │                                  │
  │                              ◄─── POST /miniapp-review
  │                                  {action: "approve"}
  │                                  → lifecycle_status: approved
  │                                  │
  │                              ◄─── POST /miniapp-build
  │                                  {submission_id}
  │                                  → status: building
  │                                  → build_completed
  │                                  → cdn_base_url set
  │                                  │
  │                              ◄─── POST /miniapp-version-create
  │                                  {build_id}
  │                                  → entry_url: {cdn}/index.html
  │                                  → status: draft
  │                                  │
  │                              ◄─── POST /miniapp-publish
  │                                  {version_id}
  │                                  → status: published
  │                                  → is_current: true
  │                                  → lifecycle_status: active
  │                                  │
  │    GET /miniapp-registry-api     │
  │    ?status=active                │
  │    ← Returns apps with entry_url │
  │                                  │
  └─► User opens /container?appId=xxx │
       → iframe loads entry_url       │
```

### 2. Official MiniApp Flow (Auto-Sync)

```
Developer: git push to main
    │
    ▼
GitHub sends webhook to:
https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-internal-webhook
    │
    ▼
miniapp-internal-webhook
    ├── Verify signature
    ├── Extract commit SHA
    └── Trigger miniapp-internal-sync
    │
    ▼
miniapp-internal-sync
    ├── Clone repo (shallow)
    ├── For each miniapp in miniapp_internal:
    │   ├── npm install && npm run build
    │   ├── Upload dist/ to R2:
    │   │   miniapps/{app_id}/{commit_sha}/
    │   ├── Create version record
    │   └── Auto-publish if configured
    │
    ▼
R2 CDN: {CDN_BASE_URL}/miniapps/{app_id}/{commit_sha}/index.html
    │
    ▼
Users access via /container?appId={app_id}
```

---

## API Endpoints

### Public Endpoints (No Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/miniapp-registry-api` | GET | List published miniapps |
| `/miniapp-stats` | GET | Get app stats + entry_url |
| `/miniapp-internal-webhook` | POST | GitHub webhook receiver |

### Protected Endpoints (Auth Required)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/miniapp-submit` | POST | User | Submit new miniapp |
| `/miniapp-review` | POST | Admin | Review submission |
| `/miniapp-build` | POST | Admin | Build and upload |
| `/miniapp-version-create` | POST | Admin | Create version |
| `/miniapp-publish` | POST | Admin | Publish version |
| `/miniapp-internal-sync` | POST | Admin | Manual sync |

---

## CDN Configuration

### R2 Storage

```
Endpoint: https://bf0d7e814f69945157f30505e9fba9fe.r2.cloudflarestorage.com
Bucket: miniapps
Region: auto

Base URL: https://bf0d7e814f69945157f30505e9fba9fe.r2.cloudflarestorage.com
```

### URL Structure

```
{miniapps_base_url}/miniapps/{app_id}/{git_commit_sha}/index.html
```

### CORS Configuration

The CDN bucket is configured to allow:
- Origin: `*` (for iframe embedding)
- Methods: GET, HEAD
- Headers: Accept, Authorization, Content-Type

---

## Security

### Authentication

- **Supabase Auth** for user authentication
- **Admin check** via `admin_emails` table
- **Service role** for privileged operations

### Authorization

```sql
-- Admin check function
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_emails WHERE user_id = p_user_id
    );
END;
$$;
```

### Rate Limiting

```sql
-- Rate limits table
CREATE TABLE rate_limits (
    identifier TEXT PRIMARY KEY,
    identifier_type TEXT DEFAULT 'ip',
    window_start TIMESTAMPTZ DEFAULT NOW(),
    request_count INTEGER DEFAULT 1
);
```

### Input Validation

- All inputs validated in Edge Functions
- Git URLs normalized with `normalize_git_url()`
- Webhook signatures verified with HMAC-SHA256

---

## Database Schema

### Key Tables

```sql
-- MiniApp Registry (master list)
CREATE TABLE miniapp_registry (
    id UUID PRIMARY KEY,
    app_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    category VARCHAR(64),
    current_version_id UUID,
    lifecycle_status TEXT DEFAULT 'draft',
    manifest JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versions (each published version)
CREATE TABLE miniapp_versions (
    id UUID PRIMARY KEY,
    app_id VARCHAR(64) NOT NULL,
    version VARCHAR(32) NOT NULL,
    version_code INTEGER NOT NULL,
    git_commit_sha VARCHAR(40) NOT NULL,
    entry_url TEXT NOT NULL,
    cdn_base_url TEXT,
    cdn_version_path TEXT,
    status TEXT DEFAULT 'draft',
    is_current BOOLEAN DEFAULT FALSE,
    published_by UUID,
    published_at TIMESTAMPTZ
);

-- Submissions (external developer submissions)
CREATE TABLE miniapp_submissions (
    id UUID PRIMARY KEY,
    app_id VARCHAR(64) NOT NULL,
    git_url TEXT NOT NULL,
    branch VARCHAR(64) DEFAULT 'main',
    subfolder TEXT,
    git_commit_sha VARCHAR(40),
    build_config JSONB,
    lifecycle_status TEXT DEFAULT 'pending_review',
    metadata JSONB,
    submitted_by UUID
);

-- Builds (build records)
CREATE TABLE miniapp_builds (
    id UUID PRIMARY KEY,
    submission_id UUID NOT NULL,
    status TEXT DEFAULT 'build_queued',
    cdn_base_url TEXT,
    cdn_version_path TEXT,
    build_log TEXT,
    triggered_by UUID
);

-- Internal miniapps (official)
CREATE TABLE miniapp_internal (
    id UUID PRIMARY KEY,
    app_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    git_url TEXT NOT NULL,
    subfolder TEXT,
    branch VARCHAR(64) DEFAULT 'main',
    entry_url TEXT,
    git_commit_sha VARCHAR(40),
    status TEXT DEFAULT 'draft'
);

-- Admin emails
CREATE TABLE admin_emails (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE,
    user_id UUID REFERENCES auth.users(id),
    role TEXT DEFAULT 'admin'
);
```

---

## Environment Variables

### Required

```bash
# Supabase
SUPABASE_URL=https://dmonstzalbldzzdbbcdj.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# CDN
CDN_BASE_URL=https://bf0d7e814f69945157f30505e9fba9fe.r2.cloudflarestorage.com
CDN_PROVIDER=r2

# R2/S3
AWS_ACCESS_KEY_ID=cc77eee149d8f679bc0f751ca346a236
AWS_SECRET_ACCESS_KEY=***REMOVED***
AWS_REGION=auto
R2_ACCOUNT_ID=bf0d7e814f69945157f30505e9fba9fe
R2_BUCKET=miniapps
```

---

## Monitoring

### Function Logs

Access via Supabase Dashboard:
```
Dashboard → Functions → [function_name] → Logs
```

### Sync History

```sql
SELECT app_id, git_commit_sha, status, created_at
FROM miniapp_internal_sync_history
ORDER BY created_at DESC
LIMIT 20;
```

### Version Status

```sql
SELECT r.app_id, r.name, v.version, v.entry_url, v.published_at
FROM miniapp_registry r
LEFT JOIN miniapp_versions v ON r.current_version_id = v.id
WHERE r.lifecycle_status = 'active';
```

---

## Troubleshooting

### Common Issues

#### 1. Webhook Not Triggering

```bash
# Check webhook delivery in GitHub
# Repository Settings → Webhooks → Recent Deliveries

# Verify webhook is active
SELECT is_active, branch FROM miniapp_internal_webhooks;
```

#### 2. Build Fails

```bash
# Check function logs
# Dashboard → Functions → miniapp-internal-sync → Logs

# Common causes:
# - Missing dependencies in package.json
# - TypeScript errors
# - Build command not found
```

#### 3. MiniApp Not Loading

```sql
-- Check registry status
SELECT app_id, lifecycle_status, current_entry_url
FROM miniapp_registry_view
WHERE app_id = 'your-app-id';

-- Verify CDN URL is accessible
curl -I "https://cdn.example.com/miniapps/your-app-id/latest/index.html"
```

#### 4. Admin Access Denied

```sql
-- Add admin email
INSERT INTO admin_emails (email, user_id)
VALUES ('admin@example.com', 'user-uuid');

-- Verify admin
SELECT is_admin('user-uuid');
```

---

## Checklist for Production

- [x] All database tables created with proper indexes
- [x] All Edge Functions deployed and active
- [x] R2 CDN configured and accessible
- [x] Webhook configured in GitHub
- [x] Admin emails inserted
- [x] CORS configured for iframe embedding
- [x] Rate limiting enabled
- [x] Error handling consistent
- [x] Input validation in place
- [x] Logging enabled

---

## Next Steps

1. **Add monitoring alerts** for build failures
2. **Set up CI/CD** for automated testing
3. **Add analytics** for miniapp usage
4. **Implement caching** for registry API
5. **Add automated tests** for critical paths

---

## Support

**Documentation:**
- `/docs/MINIAPP_OFFICIAL_SYNC.md` - Official miniapp sync guide
- `/docs/MINIAPP_AUTO_SUBMISSION.md` - Full workflow documentation

**Dashboard:**
- https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj

**Issues:**
- Check Function Logs first
- Review Sync History
- Test manually with curl
