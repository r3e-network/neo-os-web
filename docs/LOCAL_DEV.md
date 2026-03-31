# Local Development

This repo no longer boots the old in-repo Oracle / AA service layer as the
default local workflow.

Current local development means:

1. run the platform apps from this repo
2. point `.env` at external Morpheus / AA integrations
3. optionally run the external repos separately if you need isolated service runtimes

## Supported Local Modes

### Mode A: Platform-only against deployed external services

Use this for normal frontend / gateway / contract integration work.

Requirements:

- `.env` with reachable external service URLs
- Supabase project keys
- Neo N3 RPC URL

Commands:

```bash
cd /Users/jinghuiliao/git/neo-miniapps-platform
npm install
npm run validate:miniapp-env -- --stage=prod --json

cd platform/host-app
npm run dev

cd ../admin-console
npm run dev
```

### Mode B: Platform repo plus external Oracle / AA repos

Use this when you need to debug the extracted runtimes themselves.

Run:

- this repo for host/admin/edge/contracts
- `neo-morpheus-oracle` for Oracle / DataFeed / VRF / Compute / Paymaster
- `neo-abstract-account` for AA relay / verifier / UX work

Then point this repo's `.env` to those running services.

## Required Env Wiring

At minimum:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_EDGE_URL`
- `NEO_RPC_URL`
- `NEO_NETWORK_MAGIC`
- `TXPROXY_URL`

Preferred Morpheus wiring:

- `MORPHEUS_RUNTIME_URL`
- `MORPHEUS_RUNTIME_TOKEN` or `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET`
- `MORPHEUS_PUBLIC_API_URL`
- `MORPHEUS_EDGE_URL`
- `MORPHEUS_CONTROL_PLANE_URL`

Legacy split-service wiring is still supported when you are intentionally
running the old internal mesh locally:

- `NEOFEEDS_URL`
- `NEOORACLE_URL`
- `NEOVRF_URL`
- `NEOCOMPUTE_URL`

Optional but recommended when AA integration is needed:

- `AA_RELAY_URL`
- `AA_PAYMASTER_ENDPOINT`

## OS Contract Development (MiniApp-OS v2)

### Building OS Contracts

The 10 OS service contracts live under `contracts/os-*/`:

```bash
# Build a single OS contract
cd /home/neo/git/neo-miniapps-platform
dotnet build contracts/os-storage/
dotnet build contracts/os-payment/
dotnet build contracts/os-game/

# Build all contracts (including OS)
./contracts/build.sh
```

### OS Contract Hashes

When deploying OS contracts to testnet, record the hashes in `.env`:

```bash
CONTRACT_STORAGESERVICE_HASH=0x...
CONTRACT_PAYMENTSERVICE_HASH=0x...
CONTRACT_SCRIPTENGINE_HASH=0x...
CONTRACT_CHECKINSERVICE_HASH=0x...
CONTRACT_BADGESERVICE_HASH=0x...
CONTRACT_LEADERBOARDSERVICE_HASH=0x...
CONTRACT_VESTINGSERVICE_HASH=0x...
CONTRACT_GAMESERVICE_HASH=0x...
CONTRACT_ESCROWSERVICE_HASH=0x...
CONTRACT_NFTSERVICE_HASH=0x...
```

### Edge Function Development for OS Services

The 45 OS Binder edge functions live under `platform/edge/functions/os-*/`.
Each follows a standardized pattern:

1. `validateAuth(req)` — Supabase JWT check
2. Parse `{ appId, ...params }` from request body
3. `validatePermission(appId, "<service>")` — manifest permission check
4. `rateLimit(userId, appId, "<function-name>")` — rate limiting
5. `neoRpc.invokeContract(CONTRACT_HASH, "method", [appId, ...params])` — call OS contract
6. Return JSON result

To add a new OS edge function:

```bash
mkdir -p platform/edge/functions/os-<service>-<method>/
# Create index.ts following the pattern in existing os-* functions
```

### SaaS Integration Environment Variables

The host app supports optional SaaS monitoring (see `platform/host-app/.env.example`):

```bash
NEXT_PUBLIC_SENTRY_DSN=          # Sentry error reporting (leave blank to disable)
NEXT_PUBLIC_POSTHOG_KEY=         # PostHog analytics (leave blank to disable)
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## Host / Edge Integration Notes

- shared frontend Oracle / AA config lives in `apps/shared/constants/rpc.ts`
- `useOracle()` defaults to `/api/rpc` when no explicit edge base URL is given
- `useAbstractAccount()` defaults to `/api/aa/relay` for AA relay submission
- `/api/aa/relay` is only active when `AA_RELAY_URL` is configured
- OS proxy classes (`apps/shared/services/os/`) route through `EdgeClient` to the
  `os-*` edge functions; the `EdgeClient` defaults to `/api/edge` when no
  `VITE_EDGE_URL` is set

## Testnet Workflow Validation

To validate the platform against current testnet contracts:

```bash
cd /Users/jinghuiliao/git/neo-miniapps-platform
AA_TEST_WIF=<funded-aa-testnet-wif> \
bash deploy/scripts/verify_cross_repo_testnet.sh
```

Use `verify_cross_repo_testnet.sh` as the default testnet validation command.
Only use `verify_testnet_workflows.sh` when you explicitly want to inspect the
legacy compatibility submission path.

## Legacy k3s / internal-service docs

Older docs and manifests in this repo may still reference a local
`service-layer` namespace or cluster-local DNS names. Treat those as legacy or
integration-lab artifacts unless they have been explicitly updated to the
current external-runtime boundary.
