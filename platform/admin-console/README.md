# Admin Console

Next.js admin dashboard for the Neo MiniApp Platform local development stack.

## Features

- **Dashboard Home**: Service health grid, recent activity, quick stats
- **Services**: Health status monitoring, logs viewer, service controls
- **MiniApps**: List registered MiniApps, test harness, contract interaction
- **Users**: User management, API key management, role editor
- **Analytics**: Usage charts, transaction history, error rates
- **Contracts**: Deployed contracts list, deploy wizard, upgrade flow

## Tech Stack

- Next.js 14 with App Router
- TypeScript (strict mode)
- Tailwind CSS
- React Query for data fetching
- Vitest for testing

## Development

```bash
# Install dependencies
npm ci

# Run development server
npm run dev

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.localhost
NEXT_PUBLIC_EDGE_URL=https://edge.localhost
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_CONSOLE_API_KEY=your-admin-api-key
```

The admin API routes use server-only API key authentication:

1. **Same-origin browser requests:** The admin console's pages call its own
   Next.js API routes (`/api/*`). These routes run server-side and validate
   the request using a same-origin check. The browser never sees or sends
   the admin API key.

2. **Server-to-server / external callers:** Pass `X-Admin-Key` header or
   `Authorization: Bearer <key>` with the value of `ADMIN_CONSOLE_API_KEY`.

3. **Dev mode:** When `ADMIN_CONSOLE_API_KEY` is not set, all requests are
   allowed. In production, always set the key.

**IMPORTANT:** Never prefix the admin API key with `NEXT_PUBLIC_`. Doing so
exposes the secret to every browser that loads the page. Set `ADMIN_CONSOLE_API_KEY`
(or `ADMIN_API_KEY`) as a server-only environment variable.

## Deployment

### Docker

```bash
# Build image
docker build -t admin-console:latest .

# Run container
docker run -p 3002:3002 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://supabase.localhost \
  -e NEXT_PUBLIC_EDGE_URL=https://edge.localhost \
  -e ADMIN_CONSOLE_API_KEY=your-admin-api-key \
  admin-console:latest
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -k k8s/platform/admin/

# Access dashboard
https://admin.localhost
```

## Testing

The project maintains high test coverage:

- **lib/**: 90%+ coverage (API clients, hooks, utilities)
- **components/**: 70%+ coverage (UI components)

Run tests with coverage report:

```bash
npm run test:coverage
```

## Architecture

```
src/
├── app/              # Next.js App Router pages
│   ├── page.tsx      # Dashboard home
│   ├── services/     # Services health page
│   ├── miniapps/     # MiniApps management
│   ├── users/        # User management
│   ├── analytics/    # Analytics dashboard
│   ├── contracts/    # Contract deployment
│   └── api/          # API routes
├── components/       # React components
│   ├── ui/           # Reusable UI components
│   └── layout/       # Layout components
├── lib/              # Core logic
│   ├── api-client.ts # API client
│   ├── hooks/        # React Query hooks
│   └── utils.ts      # Utility functions
└── types/            # TypeScript definitions
```

## API Routes

- `GET /api/services/health` - Check all services health
- `GET /api/analytics` - Fetch analytics overview
- `GET /api/analytics/by-app` - Fetch usage by app
- `POST /api/miniapps/update-status` - Prepare AppRegistry `setStatus` on-chain invocation (and optional cache patch)

## License

Private - Neo MiniApp Platform
