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
NEXTAUTH_SECRET=your-nextauth-secret
ADMIN_CONSOLE_API_KEY=your-admin-api-key
```

The admin API routes require a matching key in `X-Admin-Key` (or `Authorization: Bearer`).
For browser calls, either set `NEXT_PUBLIC_ADMIN_CONSOLE_API_KEY` at build time or store
the key locally:

```js
localStorage.setItem("admin_api_key", "your-admin-api-key");
```

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
- `POST /api/miniapps/update-status` - Update MiniApp status

## License

Private - Neo MiniApp Platform
