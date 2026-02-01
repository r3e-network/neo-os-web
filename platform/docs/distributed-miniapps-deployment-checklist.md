# Distributed MiniApp System - Deployment Checklist

## Pre-Deployment Checklist

### 1. Infrastructure Setup

- [ ] **Supabase Project**
    - [ ] Create Supabase project (or use existing)
    - [ ] Get SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
    - [ ] Enable Row Level Security (RLS)
    - [ ] Create `admin_emails` table for admin access control

- [ ] **CDN Provider** (Choose one)
    - [ ] **Cloudflare R2** (Recommended)
        - [ ] Create R2 bucket
        - [ ] Get R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
        - [ ] Configure custom domain (optional)
    - [ ] **AWS S3**
        - [ ] Create S3 bucket
        - [ ] Get AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
        - [ ] Set AWS_REGION
        - [ ] Configure bucket policy for public read
    - [ ] **Cloudflare Images** (for images only)
        - [ ] Get CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN


### 2. Database Migrations

```bash
# Run migrations in order
supabase migration up --file platform/supabase/migrations/20250123_miniapp_submissions.sql
supabase migration up --file platform/supabase/migrations/20250123_miniapp_registry_view.sql
supabase migration up --file platform/supabase/migrations/20250123_miniapp_approval_audit.sql
```

Verify tables:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'miniapp%';

-- Expected output:
-- miniapp_submissions
-- miniapp_approval_audit
-- miniapp_registry_view (view)
```

### 3. Environment Variables

Update `k8s/platform/edge/configmap.yaml`:

```yaml
# Required values to replace:
CDN_BASE_URL: "https://your-cdn-domain.com"
CDN_PROVIDER: "r2" # or "s3" or "cloudflare"

R2_ACCOUNT_ID: "your-account-id"
R2_ACCESS_KEY_ID: "your-access-key"
R2_SECRET_ACCESS_KEY: "***REMOVED***"
R2_BUCKET: "miniapps"

SUPABASE_ANON_KEY: "your-anon-key"
SUPABASE_SERVICE_ROLE_KEY: "***REMOVED***"
```

Apply to k8s:

```bash
kubectl apply -f k8s/platform/edge/configmap.yaml
```

### 4. Admin Users

Add admin users to Supabase:

```sql
-- Insert admin emails
INSERT INTO admin_emails (user_id, email, role, created_at)
VALUES
  ('your-user-id', 'admin@example.com', 'admin', NOW()),
  ('another-user-id', 'moderator@example.com', 'moderator', NOW());

-- Get user_id from auth.users table:
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';
```

### 5. Edge Functions Deployment

Deploy Edge Functions to Supabase:

```bash
# From project root
cd platform/edge

# Deploy all miniapp functions
supabase functions deploy miniapp-submit
supabase functions deploy miniapp-approve
supabase functions deploy miniapp-build
supabase functions deploy miniapp-list
```

Verify deployment:

```bash
supabase functions list
```

### 6. Admin Console Deployment

Build and deploy admin console:

```bash
cd platform/admin-console

# Build
npm run build

# Deploy to your hosting (Vercel, Netlify, etc.)
# OR serve locally for testing
npm start
```

Update admin console environment variables:

```bash
# .env.local or hosting provider env vars
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=***REMOVED***
EDGE_FUNCTION_URL=https://your-project.supabase.co
```

### 7. Testing Workflow

#### 7.1 External Developer Submission Test

```bash
# Submit a MiniApp for review
curl -X POST https://your-project.supabase.co/functions/v1/miniapp-submit \
  -H "Authorization: Bearer DEVELOPER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "git_url": "https://github.com/username/test-miniapp",
    "branch": "main",
    "subfolder": ""
  }'
```

Expected response:

```json
{
    "submission_id": "uuid",
    "status": "pending_review",
    "detected": {
        "manifest": true,
        "assets": { "icon": ["static/icon.png"], "banner": ["static/banner.jpg"] },
        "build_type": "vite"
    }
}
```

#### 7.2 Admin Review Test

From Admin Console (`/admin/miniapps`):

1. View pending submissions
2. Review source code details
3. Approve or reject with notes
4. Publish after manual build + CDN upload

#### 8.3 Manual Publish Test

```bash
# Publish a manually built MiniApp
curl -X POST https://your-project.supabase.co/functions/v1/miniapp-publish \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "submission-uuid",
    "entry_url": "https://cdn.example.com/miniapps/app-id/version/index.html",
    "cdn_base_url": "https://cdn.example.com/miniapps/app-id/version",
    "assets_selected": {
      "icon": "https://cdn.example.com/miniapps/app-id/assets/icon.png",
      "banner": "https://cdn.example.com/miniapps/app-id/assets/banner.jpg"
    }
  }'
```

Validation checks:
- `entry_url` must be https and under `cdn_base_url`
- `cdn_base_url` must be under `CDN_BASE_URL` (same origin + path prefix)
- `assets_selected` must be https and on the `CDN_BASE_URL` origin

Expected response:

```json
{
    "success": true,
    "status": "published",
    "cdn_url": "https://cdn.example.com/miniapps/app-id/version"
}
```

#### 8.4 Host App Discovery Test

```bash
# List all published MiniApps
curl "https://your-project.supabase.co/functions/v1/miniapp-list?category=gaming"
```

## Post-Deployment Verification

### Database Queries

```sql
-- Check submissions
SELECT
  id,
  app_id,
  git_url,
  status,
  created_at
FROM miniapp_submissions
ORDER BY created_at DESC;

-- Check unified registry
SELECT
  app_id,
  source_type,
  status,
  cdn_base_url
FROM miniapp_registry_view;

-- Check approval audit log
SELECT
  action,
  reviewer_id,
  review_notes,
  created_at
FROM miniapp_approval_audit
ORDER BY created_at DESC;
```

### CDN Verification

Check CDN bucket for uploaded files:

- R2: `r2 ls miniapps/`
- S3: `aws s3 ls s3://miniapps/ --recursive`

Expected structure:

```
miniapps/
  {app_id}/
    {version}/
      index.html
      assets/
      ...
    assets/
      icon.png
      banner.jpg
```

## Monitoring & Maintenance

### Daily Checks

- [ ] Review pending submissions
- [ ] Check failed builds
- [ ] Monitor CDN storage usage
- [ ] Review approval audit log

### Weekly Tasks

- [ ] Sync internal miniapps (if updated)
- [ ] Review published MiniApp performance
- [ ] Check for stale submissions (>7 days pending)

### Monthly Tasks

- [ ] Audit admin access
- [ ] Review CDN costs
- [ ] Clean up failed build artifacts
- [ ] Generate MiniApp usage reports

## Troubleshooting

### Build Failures

```sql
-- Check failed builds
SELECT
  app_id,
  git_url,
  last_error,
  build_log,
  error_count
FROM miniapp_submissions
WHERE status = 'build_failed'
ORDER BY updated_at DESC;

-- Common issues:
-- - Pre-built files detected (dist/, build/, .next/)
-- - Missing manifest file
-- - Invalid package.json
-- - Build command not found
-- - Dependency installation failed
```

### CDN Upload Issues

```sql
-- Check submissions with CDN issues
SELECT
  app_id,
  cdn_base_url,
  cdn_version_path,
  assets_selected
FROM miniapp_submissions
WHERE status = 'published'
  AND (cdn_base_url IS NULL OR assets_selected IS NULL);
```

### Permission Issues

```sql
-- Check if user is admin
SELECT * FROM admin_emails WHERE user_id = 'your-user-id';
```

## Rollback Procedure

If issues occur after deployment:

1. **Disable new submissions**

    ```sql
    UPDATE miniapp_submissions SET status = 'suspended' WHERE status = 'pending_review';
    ```

2. **Revert problematic build**

    ```sql
    UPDATE miniapp_submissions
    SET status = 'build_failed',
        last_error = 'Rolled back due to issues'
    WHERE app_id = 'problematic-app-id';
    ```

3. **Remove from CDN**
    - Delete app folder from CDN bucket
    - `r2 rm -r miniapps/problematic-app-id/`

4. **Fix issue and redeploy**

## Security Considerations

1. **Admin Access**
    - Only trusted users in `admin_emails` table
    - Regular audits of admin list
    - Consider MFA for admin accounts

2. **Git Repository Access**
    - Private repositories recommended
    - Use deploy tokens or SSH keys
    - Rotate credentials regularly

3. **CDN Security**
    - Enable HTTPS only
    - Configure CORS properly
    - Use signed URLs for sensitive content

4. **Rate Limiting**
    - All endpoints have rate limits
    - Monitor for abuse
    - Adjust limits based on usage

## Success Criteria

- [ ] External developers can submit MiniApps
- [ ] Admins can review and approve/reject submissions
- [ ] Builds complete successfully and upload to CDN
- [ ] Host App can discover published MiniApps
- [ ] Internal MiniApps sync correctly
- [ ] Admin Console displays all data correctly
- [ ] CDN files are accessible
- [ ] No failed builds in database

---

**Deployment Date**: ****\_\_\_****

**Deployed By**: ****\_\_\_****

**Verified By**: ****\_\_\_****
