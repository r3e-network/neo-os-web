# Testing Strategy

## Test Infrastructure

### Unit Tests -- Shared Services (Vitest)

| File | Tests |
|---|---|
| `apps/shared/test/services/CacheService.test.ts` | 14 |
| `apps/shared/test/services/EventBus.test.ts` | 13 |
| `apps/shared/test/services/NotificationService.test.ts` | 12 |
| `apps/shared/test/services/ClipboardService.test.ts` | 6 |
| `apps/shared/test/services/FormattingService.test.ts` | 26 |
| `apps/shared/test/services/PlatformServices.test.ts` | 9 |
| `apps/shared/test/os-proxies.test.ts` | 33 |
| `apps/shared/test/defineMiniApp-services.test.ts` | 1 |
| `apps/shared/test/miniapp-root.runtime.test.ts` | 2 |
| **Total** | **116** |

Run with:
```bash
cd apps/shared && npx vitest run test/
```

### Edge Function Tests (Deno)

| File | Tests |
|---|---|
| `platform/edge/functions/_shared/amount_test.ts` | 17 |
| `platform/edge/functions/_shared/manifest_test.ts` | 41 |
| `platform/edge/functions/_shared/apps_test.ts` | 10 |
| `platform/edge/functions/_shared/os-service_test.ts` | 8 |
| `platform/edge/functions/_shared/community_test.ts` | 21 |
| **Total** | **97** |

Run with:
```bash
cd platform/edge/functions && deno test _shared/*_test.ts
```

### Host App Tests (Jest)

- **79 test files** across `platform/host-app/__tests__/`
  - `api/` -- 31 files (admin, catalog, cron, morpheus, search, chain endpoints)
  - `lib/` -- 25 files (auth, csrf, edge, fetch, miniapp utilities, supabase, r2)
  - `components/` -- 8 files (LaunchDock, AppNewsList, Social widgets, Leaderboard, FederatedMiniApp)
  - `hooks/` -- 4 files (useCommunity, useGamification, useRealtimeNotifications)
  - `pages/` -- 5 files (app detail, launch, miniapps index, shared runtime/invoke)
- **394 test cases** total
- **6 E2E specs** (Playwright): `platform/host-app/e2e/` -- homepage, navigation, wallet, platform-pages, miniapps-list, miniapp-detail

Run with:
```bash
cd platform/host-app && npx jest --passWithNoTests
```

### Admin Console Tests (Vitest)

- **20 test files** across `platform/admin-console/src/`
  - `lib/__tests__/` -- 12 files (api-client, api-routes, env, schemas, useMiniApps, useServices, useUsers, useAnalytics, utils, version-diff, modular-preview)
  - `components/ui/__tests__/` -- 6 files (Badge, Button, Card, Input, Spinner, Table)
  - `components/layout/__tests__/` -- 2 files (Header, Sidebar)
- **197 test cases** total

Run with:
```bash
npm run test:admin-console
```

### Deploy Script Tests (Node test runner)

| File | Tests |
|---|---|
| `deploy/scripts/lib/live_neo.test.mjs` | 7 |
| `deploy/scripts/lib/platform_service_ownership.test.mjs` | 3 |
| **Total** | **10** |

Run with:
```bash
node --test deploy/scripts/lib/*.test.mjs
```

### Layering / Architecture Tests

| File | Tests |
|---|---|
| `test/layering/define-miniapp-runtime.test.mjs` (Node) | 4 |
| `test/layering/layering_test.go` (Go) | 1 |
| `test/contract/*_test.go` (Go, 5 files) | 5 |

Run with:
```bash
node --test test/layering/define-miniapp-runtime.test.mjs
go test ./test/layering/...
go test ./test/contract/...
```

### Contract Build & Testnet Validation

- **10 OS contracts** -- `contracts/os-{badge,checkin,escrow,game,leaderboard,nft,payment,script,storage,vesting}/`
- Build with: `dotnet build contracts/os-*/*.csproj`
- **ABI validation**: `npm run test:flagship-deployed-abi`
- **Active state**: `npm run test:flagship-active-state`
- **Live user flows**: `FLAGSHIP_LIVE_WIF=<key> npm run test:flagship-live-user-flows`
- **Testnet smoke**: `npm run test:testnet:live:smoke`

## Running All Local Tests

```bash
# 1. Shared services + OS proxies (Vitest, 116 tests)
cd apps/shared && npx vitest run test/

# 2. Host app (Jest, 394 tests)
cd platform/host-app && npx jest --passWithNoTests

# 3. Admin console (Vitest, 197 tests)
npm run test:admin-console

# 4. Deploy scripts (Node test runner, 10 tests)
node --test deploy/scripts/lib/*.test.mjs

# 5. Layering guards (Node test runner, 4 tests)
node --test test/layering/define-miniapp-runtime.test.mjs

# 6. Edge function tests (requires Deno)
cd platform/edge/functions && deno test _shared/*_test.ts

# 7. Contract builds (requires dotnet SDK)
for dir in contracts/os-*/; do dotnet build "$dir"*.csproj; done

# 8. Go contract / layering tests (requires Go)
go test ./test/...

# Or use the root npm script for the main three suites:
npm test
```

## Test Totals

| Suite | Files | Tests | Runner |
|---|---|---|---|
| Shared services + proxies | 9 | 116 | Vitest |
| Host app unit | 79 | 394 | Jest |
| Host app E2E | 6 | -- | Playwright |
| Admin console | 20 | 197 | Vitest |
| Edge functions | 5 | 97 | Deno |
| Deploy scripts | 2 | 10 | Node test runner |
| Layering guards | 1 | 4 | Node test runner |
| Go contract + layering | 6 | 5+ | Go test |
| **Total** | **128** | **823+** | |

## Coverage Targets

- Critical paths (OS proxies, shared services, edge utils): 80%+
- Host app API routes and core lib: 60%+
- Admin console lib and components: 40%+
- Edge functions: 20%+
- MiniApp composables: best-effort per-app

## Known Issues

- Running `npx vitest run apps/shared/test/` from the repo root picks up duplicate files under `platform/host-app/.next/standalone/`. Always run from `apps/shared/` or use the workspace config.
- Host app has 1 failing test in `morpheus.neodid.providers.test.ts` (edge URL expectation mismatch) as of the last run.
