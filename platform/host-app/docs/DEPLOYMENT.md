# Deployment Guide

Deploy the Neo MiniApp Platform to production.

## Prerequisites

- Vercel account (recommended)
- Supabase project
- Domain name (optional)

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Auth0 (optional)
AUTH0_SECRET=xxx
AUTH0_BASE_URL=https://neomini.app
AUTH0_ISSUER_BASE_URL=https://xxx.auth0.com
AUTH0_CLIENT_ID=xxx
AUTH0_CLIENT_SECRET=xxx

# Sentry (optional)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Build Commands

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Post-Deployment

1. Configure custom domain in Vercel
2. Set up SSL certificate
3. Verify environment variables
4. Test wallet connections
5. Monitor error tracking

## See Also

- [Getting Started](./GETTING_STARTED.md)
- [Architecture](./ARCHITECTURE.md)
