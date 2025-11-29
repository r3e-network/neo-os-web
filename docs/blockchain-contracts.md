# Blockchain Contract Integration

Operate the Service Layer as a Supabase-backed service OS and push its data to on-chain contracts (Neo privnet by default). This guide ties together the Supabase runtime, SDKs, and the on-chain helpers under `examples/`.

## Prerequisites
- Self-hosted Supabase Postgres DSN exported as `DATABASE_URL` (the runtime accepts `DATABASE_URL` everywhere).
- Supabase GoTrue configured with `SUPABASE_JWT_SECRET` (and `SUPABASE_GOTRUE_URL` for `/auth/refresh`).
- Optional: start the privnet node and indexer with `make run-neo` (RPC on `http://localhost:20332`).

## Workflow
1) **Start the stack**  
   ```bash
   docker compose --profile supabase up -d --build   # Supabase + appserver + dashboard
   make run-neo                                      # optional privnet + indexer
   ```
2) **Seed data for contracts**  
   - Create an account and a price feed with snapshots (CLI: `slctl pricefeeds ...` or dashboard).  
   - SDK options:  
     - TypeScript: `sdk/typescript/client` (`ServiceLayerClient`), supports `refreshToken` for Supabase GoTrue.  
     - Go: `sdk/go/client`, supports `RefreshToken` for transparent `/auth/refresh`.
3) **Push on-chain**  
   - Node helper: `examples/neo-privnet-contract` → `npm run invoke` (env in `.env.example`).  
   - Go helper: `examples/neo-privnet-contract-go` → `go run ./...` (env in `.env.example`).  
   Both pull the latest price snapshot from the Service Layer and call `updatePrice` (configurable) on your contract.
4) **Verify**  
   - Check the transaction via the privnet RPC response and the contract logs.  
   - Use the dashboard Neo panel or `slctl neo status`/`slctl neo blocks <height>` to confirm indexed state.

## Supabase-first expectations
- `DATABASE_URL` is the primary DSN override for all config loaders and the appserver.
- When `SUPABASE_JWT_SECRET` is set, `SUPABASE_GOTRUE_URL` is required so `/auth/refresh` can proxy to your self-hosted GoTrue.
- Map roles with `SUPABASE_ADMIN_ROLES` and derive tenants/roles from claims with `SUPABASE_TENANT_CLAIM` / `SUPABASE_ROLE_CLAIM` to keep admin and multi-tenant enforcement consistent.
- Auto-migrations: enable with `-migrate` or `database.migrate_on_start` (see `configs/config.migrate.yaml`); samples default to on for local/dev. Disable when running migrations via CI/CD.

## Minimal SDK snippets
```ts
// TypeScript (Supabase refresh token aware)
import { ServiceLayerClient } from '@service-layer/client';
const client = new ServiceLayerClient({
  baseURL: 'http://localhost:8080',
  refreshToken: process.env.SUPABASE_REFRESH_TOKEN,
});
const feeds = await client.pricefeeds.list();
```

```go
// Go client with refresh token
import sl "github.com/R3E-Network/service_layer/sdk/go/client"
cli := sl.New(sl.Config{
	BaseURL:      "http://localhost:8080",
	RefreshToken: os.Getenv("SUPABASE_REFRESH_TOKEN"),
	TenantID:     os.Getenv("SERVICE_LAYER_TENANT"),
})
feeds, _ := cli.PriceFeeds.List(context.Background(), sl.PaginationParams{Limit: 10})
_ = feeds
```
