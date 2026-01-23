# MiniApp System - Deployment Status

## ✅ Completed Tasks

### 1. Database Migrations

All MiniApp-related migrations have been successfully applied to the remote database:

| Migration File                            | Table/View Created           | Status     |
| ----------------------------------------- | ---------------------------- | ---------- |
| 20250122000003_admin_emails.sql           | admin_emails table           | ✅ Applied |
| 20250123000001_miniapp_submissions.sql    | miniapp_submissions table    | ✅ Applied |
| 20250123000002_miniapp_internal.sql       | miniapp_internal table       | ✅ Applied |
| 20250123000003_miniapp_registry_view.sql  | miniapp_registry_view        | ✅ Applied |
| 20250123000004_miniapp_approval_audit.sql | miniapp_approval_audit table | ✅ Applied |

### 2. Edge Functions Deployed

All Edge Functions have been deployed to Supabase:

| Function         | URL                                                                    | Status      |
| ---------------- | ---------------------------------------------------------------------- | ----------- |
| miniapp-submit   | https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-submit   | ✅ Deployed |
| miniapp-approve  | https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-approve  | ✅ Deployed |
| miniapp-build    | https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-build    | ✅ Deployed |
| miniapp-list     | https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-list     | ✅ Deployed |
| miniapp-internal | https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-internal | ✅ Deployed |

### 3. Code Implementation

- ✅ Git manager for cloning repositories
- ✅ Asset detection (icon, banner, etc.)
- ✅ Build detection (Vite, Webpack, uni-app, Next.js)
- ✅ CDN upload support (R2, S3, Cloudflare, Vercel)
- ✅ Admin console UI hooks
- ✅ TypeScript compilation fixes

## 🔧 Pending Tasks

### 1. Admin User Setup (REQUIRED)

**Action Required**: Add admin user to authorize Edge Functions

**Steps**:

1. Go to https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/sql
2. Run this query to list users:
    ```sql
    SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;
    ```
3. Copy a user_id from the results
4. Run this INSERT (replace with actual values):
    ```sql
    INSERT INTO public.admin_emails (user_id, email, role)
    VALUES (
        'YOUR_USER_ID_HERE',
        'your-email@example.com',
        'admin'
    )
    ON CONFLICT (email) DO UPDATE SET
        role = EXCLUDED.role,
        updated_at = NOW();
    ```
5. Verify:
    ```sql
    SELECT * FROM public.admin_emails;
    ```

**See**: `platform/docs/add-admin-user.sql` for detailed instructions

### 2. Vercel CDN Configuration (REQUIRED)

**Action Required**: Configure Vercel Blob Storage environment variables

**Steps**:

1. Go to https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/functions/settings
2. Add these environment variables:
    ```
    CDN_BASE_URL=https://your-vercel-blob-url.com
    CDN_PROVIDER=vercel
    VERCEL_BLOB_TOKEN=your-vercel-blob-token
    VERCEL_BLOB_STORE_ID=your-blob-store-id
    ```
3. Click Save

**Note**: To get Vercel Blob credentials:

- Go to https://vercel.com/blob
- Create a new Blob store or use existing
- Copy the Store ID and API Token

### 3. Internal MiniApps Sync (OPTIONAL)

**Action Required**: Sync pre-built MiniApps from platform repository

**Steps**:

1. Call the miniapp-internal Edge Function:
    ```bash
    curl -X POST https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-internal/sync \
      -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json"
    ```
2. Verify sync:
    ```sql
    SELECT app_id, status, category FROM miniapp_internal;
    ```

## 📋 Testing Workflow

After completing the pending tasks, test the full workflow:

### Step 1: Submit a MiniApp (External Developer)

```bash
curl -X POST https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-submit \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "git_url": "https://github.com/example/miniapp-demo.git",
    "subfolder": "",
    "branch": "main"
  }'
```

### Step 2: Review and Approve (Admin)

```bash
curl -X POST https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-approve \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "SUBMISSION_UUID",
    "action": "approve"
  }'
```

### Step 3: Build and Publish (Admin)

```bash
curl -X POST https://dmonstzalbldzzdbbcdj.supabase.co/functions/v1/miniapp-build \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "SUBMISSION_UUID"
  }'
```

### Step 4: Query Registry (Host App)

```bash
curl https://dmonstzalbldzzdbbcdj.supabase.co/rest/v1/miniapp_registry_view \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```

## 🔗 Quick Links

- **Supabase Dashboard**: https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj
- **SQL Editor**: https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/sql
- **Edge Functions**: https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/functions
- **Function Settings**: https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/functions/settings

## 📄 Related Documentation

- `platform/docs/distributed-miniapps-deployment-checklist.md` - Full deployment guide
- `platform/docs/distributed-miniapps-guide.md` - User guide for the MiniApp system
- `platform/docs/add-admin-user.sql` - SQL script for adding admin users
- `platform/docs/database-setup-for-supabase.sql` - Complete database schema

## 🎯 Success Criteria

- [x] All database tables created
- [x] All Edge Functions deployed
- [ ] At least one admin user added
- [ ] Vercel CDN environment variables configured
- [ ] End-to-end workflow tested (submit → approve → build → publish)
- [ ] Internal MiniApps synced (optional)
