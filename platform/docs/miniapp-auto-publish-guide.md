# GitHub Actions Auto-Publish Configuration

## Overview

Internal MiniApps are automatically built and published when you push changes to `miniapps-uniapp/apps/*` on the main/master branch. No manual review required.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Push to main   │───▶│  GitHub Actions  │───▶│  Vercel Blob    │
│  (app changes)  │    │  (build & upload)│    │  (CDN storage)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Supabase Edge  │
                                              │  /update endpoint│
                                              │  (update DB)     │
                                              └─────────────────┘
```

## Setup GitHub Secrets

Go to: https://github.com/R3E-Network/service_layer/settings/secrets/actions

### Required Secrets

| Secret Name                 | Description                             | How to Get                                                               |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| `SUPABASE_URL`              | Your Supabase project URL               | https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/settings/api |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for database updates) | Same as above (use `service_role` key)                                   |
| `SUPABASE_ANON_KEY`         | Anonymous key (for queries)             | Same as above (use `anon` key)                                           |
| `VERCEL_BLOB_TOKEN`         | Vercel Blob Storage API token           | https://vercel.com/blob → API Tokens                                     |
| `VERCEL_TEAM_ID`            | (Optional) Vercel Team ID               | Your Vercel team settings                                                |

### Getting Vercel Blob Token

1. Go to https://vercel.com/blob
2. Click "Create Account" or sign in
3. Go to Settings → API Tokens
4. Create a new token
5. Copy the token to GitHub Secrets as `VERCEL_BLOB_TOKEN`

## Workflow Triggers

The workflow runs automatically when:

1. **Push to main/master** with changes in `miniapps-uniapp/apps/*`
2. **Manual trigger** via GitHub Actions UI

### Manual Trigger

1. Go to https://github.com/R3E-Network/service_layer/actions
2. Select "Internal MiniApps Auto-Publish"
3. Click "Run workflow" → Select branch → "Run workflow"

## What Gets Published

When you push changes to a MiniApp:

1. **Changed Apps Detected**: Only modified apps are rebuilt
2. **Build Process**: Each app is built with `pnpm build`
3. **CDN Upload**: Build output uploaded to Vercel Blob Storage
4. **Database Update**: `miniapp_internal` table updated with new URLs

## Version Tracking

Each published version is tracked by:

- **current_version**: Git commit SHA (short, e.g., `a1b2c3d4`)
- **previous_version**: Previous version (for rollback)
- **entry_url**: CDN URL with version path

Example URL:

```
https://blob.vercel-storage.com/miniapps/coin-flip/a1b2c3d4/index.html
```

## Environment Variables in Supabase

Make sure these are set in Supabase Edge Functions:

https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/functions/settings

```
INTERNAL_MINIAPPS_REPO_URL=https://github.com/R3E-Network/service_layer.git
INTERNAL_MINIAPPS_PATH=miniapps-uniapp/apps
INTERNAL_CDN_BASE_URL=https://blob.vercel-storage.com
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=***REMOVED***
SUPABASE_ANON_KEY=your-anon-key
```

## Testing

### 1. Make a Change

Edit any file in `miniapps-uniapp/apps/<app-name>/`:

```bash
# Example: Update coin-flip manifest
cd miniapps-uniapp/apps/coin-flip
# Edit neo-manifest.json
git add neo-manifest.json
git commit -m "feat: update coin-flip manifest"
git push origin master
```

### 2. Monitor Workflow

1. Go to https://github.com/R3E-Network/service_layer/actions
2. Watch "Internal MiniApps Auto-Publish" workflow
3. Click on the run to see details

### 3. Verify Publication

Query the database:

```bash
curl "https://dmonstzalbldzzdbbcdj.supabase.co/rest/v1/miniapp_internal?app_id=eq.com.example.coin-flip" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```

## Rollback

To rollback to a previous version, you can manually update the database:

```sql
UPDATE miniapp_internal
SET current_version = previous_version,
    entry_url = CONCAT('https://blob.vercel-storage.com/miniapps/', app_id, '/', previous_version, '/index.html')
WHERE app_id = 'your-app-id';
```

Or re-deploy the previous commit:

```bash
git checkout <previous-commit-sha>
git push origin master --force
```

## Troubleshooting

### Build Fails

1. Check the GitHub Actions logs for specific error
2. Ensure `package.json` has correct build script
3. Verify all dependencies are available

### Upload to Vercel Fails

1. Verify `VERCEL_BLOB_TOKEN` is correctly set
2. Check Vercel Blob Storage has available space
3. Ensure network connectivity from GitHub Actions

### Database Update Fails

1. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
2. Check Supabase Edge Function logs
3. Ensure `/update` endpoint is deployed

## Security Notes

- **Service Role Key Required**: Only service role can call `/update` endpoint
- **No User Input in Commands**: All inputs are controlled by repo content
- **GitHub Actions Isolation**: Build runs in isolated GitHub runners

## Related Files

- `.github/workflows/miniapp-auto-publish.yml` - Workflow definition
- `platform/edge/functions/miniapp-internal/sync.ts` - `/update` endpoint
- `platform/docs/deployment-status.md` - Overall deployment status
