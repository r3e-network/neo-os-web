# GitHub Actions Auto-Publish Configuration

## Overview

Internal MiniApps are built and published from the `r3e-network/miniapps` repo using the standard submission pipeline. Submissions from the internal repo are auto-approved and published without manual review.

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
                                              │  /miniapp-publish│
                                              │  (update DB)     │
                                              └─────────────────┘
```

## Setup GitHub Secrets

Go to: https://github.com/R3E-Network/miniapps/settings/secrets/actions

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

1. **Push to main/master** with changes in `apps/*`
2. **Manual trigger** via GitHub Actions UI

### Manual Trigger

1. Go to https://github.com/R3E-Network/miniapps/actions
2. Select "MiniApps Auto-Publish"
3. Click "Run workflow" → Select branch → "Run workflow"

## What Gets Published

When you push changes to a MiniApp:

1. **Changed Apps Detected**: Only modified apps are rebuilt
2. **Build Process**: Each app is built with `pnpm build`
3. **CDN Upload**: Build output uploaded to Vercel Blob Storage
4. **Database Update**: `miniapp_submissions` updated via `/functions/v1/miniapp-publish`

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
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=***REMOVED***
SUPABASE_ANON_KEY=your-anon-key
```

## Testing

### 1. Make a Change

Edit any file in `apps/<app-name>/`:

```bash
# Example: Update coin-flip manifest
cd /path/to/miniapps/apps/coin-flip
# Edit neo-manifest.json
git add neo-manifest.json
git commit -m "feat: update coin-flip manifest"
git push origin master
```

### 2. Monitor Workflow

1. Go to https://github.com/R3E-Network/miniapps/actions
2. Watch "Internal MiniApps Auto-Publish" workflow
3. Click on the run to see details

### 3. Verify Publication

Query the database:

```bash
curl "https://dmonstzalbldzzdbbcdj.supabase.co/rest/v1/miniapp_submissions?app_id=eq.com.example.coin-flip&status=eq.published" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```

## Rollback

To rollback to a previous version, re-run the build and publish workflow for a previous commit:

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

- **Service Role Key Required**: Only service role can call `/miniapp-publish`
- **No User Input in Commands**: All inputs are controlled by repo content
- **GitHub Actions Isolation**: Build runs in isolated GitHub runners

## Related Files

- `miniapps/.github/workflows/miniapp-auto-publish.yml` - Workflow definition (in miniapps repo)
- `platform/edge/functions/miniapp-publish` - Publish endpoint
- `platform/docs/deployment-status.md` - Overall deployment status
