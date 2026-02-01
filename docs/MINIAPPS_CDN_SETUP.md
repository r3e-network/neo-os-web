# MiniApps CDN Setup Guide

This document describes how to set up CDN hosting for Neo MiniApps static files.

## Options

### Option 1: Vercel (Recommended for Official Miniapps)

**Pros:**
- Global edge network (fast worldwide)
- Free tier available
- Git-based deployment
- Automatic CI/CD

**Setup:**

1. Create a new Vercel project linked to the miniapps repository
2. Configure Root Directory: `platform/public`
3. Or use a separate repository for miniapps-static

**Vercel Configuration:**

```json
// vercel.json
{
  "framework": "presets",
  "buildCommand": "echo 'Static files - no build needed'",
  "outputDirectory": ".",
  "cleanUrls": true
}
```

**URL Pattern:**
```
https://miniapps-static.vercel.app/lottery/index.html
```

---

### Option 2: Supabase Storage (Recommended for User-Uploaded Miniapps)

**Pros:**
- Integrated with Supabase (already in your stack)
- Lower cost for large files
- API-based upload
- Row Level Security (RLS) for access control

**Setup:**

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="***REMOVED***"

# Create storage bucket
node scripts/setup-miniapps-cdn.js --setup

# Upload miniapps
node scripts/setup-miniapps-cdn.js --upload

# Get app URL
node scripts/setup-miniapps-cdn.js --url miniapp-lottery
```

**URL Pattern:**
```
https://your-project.supabase.co/storage/v1/object/public/miniapps/official/lottery/index.html
```

**Enable CDN for Supabase:**

Supabase doesn't have built-in CDN, but you can:

1. **Use Cloudflare in front of Supabase:**
   - Set up Cloudflare proxy
   - Cache static files at edge
   - Configure cache rules for `/storage/v1/object/public/miniapps/*`

2. **Or use Supabase + Vercel for CDN:**
   - Upload to Supabase Storage
   - Deploy to Vercel from Supabase backup
   - Use Vercel as primary CDN

---

### Option 3: Hybrid Approach (Recommended)

Use both Vercel and Supabase:

| Source | Use Case | CDN |
|--------|----------|-----|
| Vercel | Official curated miniapps | Vercel Edge |
| Supabase | User-submitted miniapps | Cloudflare + Supabase |

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│              Platform Frontend                   │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Vercel CDN     Supabase +       GitHub Raw
   (Official)     Cloudflare        (Backup)
        │               │               │
        └───────────────┴───────────────┘
                        │
                   Platform API
              (Route to correct CDN)
```

---

## CDN URL Configuration

Update `platform/host-app/data/miniapps.json` with CDN URLs:

```json
{
  "gaming": [
    {
      "app_id": "miniapp-lottery",
      "entry_url": "https://miniapps-static.vercel.app/lottery/index.html",
      "cdn_url": "https://miniapps-static.vercel.app/lottery/",
      "static_url": "https://miniapps-static.vercel.app/lottery/static/"
    }
  ]
}
```

---

## Platform Integration

### Load MiniApp from CDN

```typescript
// platform/host-app/lib/miniapp-cdn.ts

export function getMiniAppUrl(app: MiniAppInfo): string {
  // Priority: CDN URL > static URL > entry URL
  if (app.cdn_url) return `${app.cdn_url}index.html`;
  if (app.static_url) return `${app.static_url}index.html`;
  return app.entry_url;
}

export function getMiniAppStaticUrl(app: MiniAppInfo, path: string): string {
  if (app.cdn_url) return `${app.cdn_url}${path}`;
  if (app.static_url) return `${app.static_url}${path}`;
  // Fallback to local public folder
  return `/miniapps/${app.app_id.replace("miniapp-", "")}/${path}`;
}
```

---

## CI/CD for CDN Updates

### Vercel Auto-Deploy

Connect the miniapps repository to Vercel:
1. Import repository in Vercel
2. Configure build settings
3. Enable "Deploy on Push"

### Supabase Sync Workflow

```yaml
# .github/workflows/sync-miniapps-to-cdn.yml
name: Sync Miniapps to CDN

on:
  schedule:
    - cron: "0 */4 * * *"  # Every 4 hours
  workflow_dispatch:

jobs:
  sync-to-vercel:
    if: env.VERCEL_TOKEN
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        run: |
          curl -X POST "https://api.vercel.com/v1/integrations/deploy/..."
          # Configure with your Vercel integration

  sync-to-supabase:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Upload to Supabase
        run: |
          npm install -g pnpm
          pnpm install
          node scripts/setup-miniapps-cdn.js --upload
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

---

## Troubleshooting

### CORS Issues

If miniapps fail to load due to CORS:

**For Supabase:**
```javascript
// Configure CORS via Supabase Edge Functions or proxy
```

**For Vercel:**
Vercel handles CORS automatically for static files.

### 404 Not Found

1. Verify file exists in storage
2. Check URL path matches storage path
3. Ensure storage bucket is public

### Cache Issues

Set cache headers for static files:

**Vercel:** Add `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, s-maxage=86400" }
      ]
    }
  ]
}
```

**Supabase:** Configure cache via Cloudflare if using CDN.

---

## Security Considerations

1. **Validate file types** - Only allow safe MIME types
2. **Scan for malware** - Run virus scan on uploads
3. **Rate limiting** - Prevent abuse
4. **Access control** - Use RLS for private miniapps
5. **Content security** - CSP headers for loaded miniapps
