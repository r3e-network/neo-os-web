# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Note: this repository's **current** architecture uses a Supabase Edge gateway and a
> small set of enclave services (see `README.md` and `docs/ARCHITECTURE.md`).

## [Unreleased]

### Refactor

- Standardized bootstrapping for all 52 miniapps via a shared entry helper.
- Unified all 52 index pages on `MiniAppShell` with centralized error-boundary wiring.
- Added and adopted shared `MiniAppOperationStats` and `MiniAppTabStats` wrappers.
- Added template preset utilities and scaffold generation based on `MiniAppShell`.
- Updated miniapp validation to accept and enforce shared template usage (`MiniAppTemplate` or `MiniAppShell`).
- Extracted shared `useTicker` and `ownerMatchesAddress` reuse paths to reduce duplication.
- Updated miniapp integration docs for the standardized composition model.

### Verification

- `node scripts/validate-miniapps.mjs` passed (52/52).
- `pnpm turbo typecheck --filter='./miniapps/*'` passed.
- `pnpm turbo build:h5 --filter='./miniapps/*'` passed (53/53; warnings only).

### Commit Breakdown

- `24c1e3f`
- `bb74012`
- `4f5f551`
- `c8ebb28`

### Refactor (Continued)

- Replaced duplicated contract-resolution and event-pagination logic in 5 miniapps with shared `useContractAddress` and `useAllEvents`.
- Extended `useAllEvents` with optional per-event error handling to preserve app-level fallback behavior.
- Added shared `createPrimaryStatsTemplateConfig` and adopted it across 12 miniapps with repeated primary+stats tab setups.
- Replaced the last direct index-page `NeoStats` usage (`timestamp-proof`) with shared `MiniAppTabStats`.
- Updated miniapp validator conventions to recognize `createPrimaryStatsTemplateConfig` as a shared template-config helper.

### Verification (Continued)

- `node scripts/validate-miniapps.mjs` passed (52/52) after each refactor batch.
- `pnpm turbo build:h5 --filter='./miniapps/*'` passed (53/53; warnings only).
- `pnpm --filter miniapp-timestamp-proof build:h5` passed.
- `pnpm --filter miniapp-coinflip build:h5` passed.
- `pnpm --filter miniapp-self-loan build:h5` passed.

### Commit Breakdown (Continued)

- `5c8a661`
- `078ccca`
- `df196bf`
- `e8230b0`
- `758cd34`

### Refactor (Continued 2)

- Reused shared `useContractAddress` in 6 additional composables (`dev-tipping`, `soulbound-certificate`, `neo-gacha` publish/machines/management, and `million-piece-map` tiles).
- Preserved existing user-facing error copy where miniapps used app-specific contract-missing messages.
- Removed one stale unused import during the `million-piece-map` migration.

### Verification (Continued 2)

- `node scripts/validate-miniapps.mjs` passed (52/52).
- `pnpm turbo typecheck --filter='./miniapps/*'` passed.
- `pnpm turbo typecheck --filter=miniapp-dev-tipping --filter=miniapp-soulbound-certificate --filter=miniapp-neo-gacha --filter=miniapp-millionpiecemap` passed.
- `pnpm turbo build --filter=miniapp-dev-tipping --filter=miniapp-soulbound-certificate --filter=miniapp-neo-gacha --filter=miniapp-millionpiecemap` passed (warnings only).

### Commit Breakdown (Continued 2)

- `7f4b947`
- `70e58ba`

### Refactor (Continued 3)

- Extended shared `useContractAddress` with optional silent chain-check handling to support guard-style flows without UI noise.
- Migrated remaining special-case resolvers in `quadratic-funding` and `council-governance` to the shared helper while preserving app-specific error messaging behavior.

### Verification (Continued 3)

- `node scripts/validate-miniapps.mjs` passed (52/52).
- `pnpm turbo typecheck --filter='./miniapps/*'` passed.
- `pnpm turbo build --filter=miniapp-quadratic-funding --filter=miniapp-council-governance` passed (warnings only).

### Commit Breakdown (Continued 3)

- `b25dd33`

### Refactor (Continued 4)

- Replaced direct contract-address lookups with shared resolver usage in `lottery` and `neo-swap`.
- Removed unused contract/wallet scaffolding from `memorial-shrine` composables.
- Reduced remaining direct `getContractAddress()` usages in miniapps to 3 files (`lottery` scratch card, `turtle-match`, `neoburger`).

### Verification (Continued 4)

- `node scripts/validate-miniapps.mjs` passed (52/52).
- `pnpm turbo typecheck --filter='./miniapps/*'` passed.
- `pnpm turbo build --filter=miniapp-memorial-shrine --filter=miniapp-lottery --filter=miniapp-neo-swap` passed (warnings only).

### Commit Breakdown (Continued 4)

- `28858c7`

### Refactor (Continued 5)

- Migrated the final three direct contract-address call sites (`lottery` scratch card, `neoburger`, `turtle-match`) to shared `useContractAddress`.
- Reduced direct `getContractAddress()` usage in `miniapps/*/src` to zero.

### Verification (Continued 5)

- `node scripts/validate-miniapps.mjs` passed (52/52).
- `pnpm turbo typecheck --filter='./miniapps/*'` passed.
- `pnpm turbo build --filter=miniapp-lottery --filter=miniapp-neoburger --filter=miniapp-turtle-match` passed (warnings only).

### Commit Breakdown (Continued 5)

- `7dd7cb8`

## [2.1.0] - 2026-02-11

### Security Hardening

#### Fixed

- **supabaseAdmin Migration** — All server-side services now use `supabaseAdmin` (service-role) via guarded `db()` helper instead of anon `supabase` client. Eliminates RLS bypass risks across 20+ API routes.
- **timingSafeEqual Adoption** — Password verification, CSRF token comparison, and cron auth all use `crypto.timingSafeEqual` to prevent timing side-channel attacks.
- **Admin Secrets Isolation** — `SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, and other admin secrets removed from client bundle via `t3-oss/env-nextjs` server-only enforcement.
- **Wallet Auth Hardening** — Signature verification extracted to dedicated `wallet-auth.ts` module with proper nonce validation and expiry checks.
- **Cron Auth Module** — Dedicated `cron-auth.ts` with constant-time `CRON_SECRET` comparison replaces inline checks across 8 cron routes.

#### Added

- **`createHandler` API Factory** — Unified request handler with built-in auth, rate limiting, Zod schema validation, and structured error responses. Migrated 13 write-operation API routes.
- **Zod Validation Schemas** — `lib/schemas/common.ts` provides reusable schemas (`addressSchema`, `paginationSchema`, `appIdSchema`, etc.) shared across all API routes.
- **Contract Query Module** — `lib/chains/contract-queries.ts` centralizes all Neo N3 RPC contract invocations with proper error handling.

### Refactoring

#### Changed

- **API Route Consolidation** — Removed duplicate route files (`/api/neoburger-stats` → `/api/neoburger/stats`, `/api/market-trending` → `/api/market/trending`). Deleted `/api/debug/test-supabase`.
- **Chain Module Cleanup** — Merged `lib/chain/` into `lib/chains/` with unified exports. Removed dead `rpc-client.ts` and `contract-queries.ts` from old location.
- **Wallet Components** — Removed legacy `PasswordSetupModal.tsx` and `UnifiedWalletConnect.tsx`, consolidated into existing wallet flow.
- **MiniApp Template System** — All 40+ miniapps migrated to shared `MiniAppTemplate` component system with unified SDK wallet initialization.
- **Service Layer Audit** — Comprehensive review of all 24 `lib/` modules confirming correct client/server separation, proper error handling, and consistent patterns.

#### Removed

- **Dead Code** — Removed `lib/chain/` directory (3 files), 2 legacy wallet components, 1 debug API route, ~200 stale static asset files from miniapp rebuilds.
- **Net Code Reduction** — 4,992 insertions vs 7,007 deletions (net −2,015 lines).

### Testing

- **858/858 Tests Passing** — Full test suite green across all modules.
- **30+ New Test Files** — Coverage for API routes (admin, automation, batch-stats, chat, collections, council, cron, developer, discovery, explorer, folders, hall-of-fame, messaging, miniapp CRUD, notifications, secrets, subscriptions, tokens, wishlist), lib modules (admin-auth, bridge-handler, chains, contracts, create-handler, cron-auth, env, memory-cache, miniapp-stats, neohub-account-service, notifications-store, wallet-auth).

### Infrastructure

- **Cross-Package Version Alignment** — All packages bumped to 2.1.0.
- **Sidebar Component Extraction** — Layout sidebar extracted to dedicated `components/layout/sidebar/` directory.
- **RPC Functions Module** — `lib/chains/rpc-functions.ts` provides typed wrappers for Neo N3 RPC calls.

## [2.0.0] - 2026-01-31

### Major Architecture Refactoring

This release includes a comprehensive architecture modernization with significant code reduction and improved maintainability.

#### Added

- **8 New Infrastructure Components** for code reuse:
  - `infrastructure/security/replay.go` - Thread-safe replay attack protection
  - `infrastructure/resilience/config.go` - Circuit breaker configuration helpers (Default/Strict/Lenient)
  - `infrastructure/middleware/ratelimiter_config.go` - Rate limiter configuration management
  - `infrastructure/httputil/handler.go` - HTTP handler helpers reducing boilerplate by 60-80%
  - `infrastructure/service/stats.go` - Statistics collector with fluent API
  - `infrastructure/service/routes.go` - Route group helper with middleware chaining
  - `infrastructure/resilience/chaos_test.go` - 20 chaos engineering tests
  - `test/integration/workflow_integration_test.go` - 9 comprehensive workflow tests

- **18 New Test Files** with comprehensive coverage:
  - Replay protection tests (9 tests)
  - Stats collector tests (9 tests)
  - Chaos engineering tests (20 tests)
  - Workflow integration tests (9 tests)

- **Comprehensive Documentation**:
  - `ARCHITECTURE_REFACTORING_SUMMARY.md` - Detailed refactoring documentation
  - `ARCHITECTURE_REFACTORING_FINAL.md` - Final refactoring summary
  - `CLEANUP_REPORT.md` - Cleanup report with 3.0 GB space freed
  - `VERSION` file for version tracking

#### Changed

- **Code Duplication Reduced by ~73%** across all 13 services
- **~380 lines saved per service** through shared components
- **~3,000-4,000 total lines eliminated** through refactoring
- **Repository size reduced by ~54%** (5.5 GB -> 2.5 GB)

#### Fixed

- **Test Synchronization Issues** - Fixed sync.Once cache problems in database tests
- **Import Path Corrections** - Fixed automation handlers import paths
- **Panic Recovery** - Added panic recovery to all production goroutines (6 locations)
- **Error Wrapping** - Standardized error wrapping across services (150+ locations)
- **Atomic Operations** - Implemented ConfirmDepositAtomic for database consistency
- **Timeout Protection** - Added trigger execution timeout protection (5 minutes)

#### Security

- **Replay Protection** - Added thread-safe replay attack prevention
- **Panic Recovery** - All goroutines now have panic recovery
- **Error Sanitization** - Errors no longer leak sensitive information
- **Rate Limiting** - Consistent rate limiting across all services

#### Performance

- **Circuit Breaker Integration** - Prevents cascade failures
- **Retry Logic** - 3 retries with exponential backoff and jitter
- **Connection Pooling** - Optimized HTTP client connection pools
- **Concurrent Safety** - Proper semaphore and mutex usage

#### Removed

- **Legacy Documentation** - Removed 8 legacy documentation files from `docs/legacy/`
- **Build Caches** - Removed .next, .turbo, .temp directories (~810 MB)
- **Android Build Artifacts** - Removed build directory (~2.1 GB)
- **System Files** - Removed .DS_Store and Thumbs.db files
- **Old Cache Files** - Removed webpack .old cache files

### Integration Test Coverage

#### Business Workflow Tests

- GasBank complete workflow (deposits, fees, reserves, releases)
- Automation trigger workflow (cron/condition execution)
- DataFeed price aggregation (multi-source aggregation)

#### Cross-Cutting Concern Tests

- Cross-service integration (multi-service coordination)
- Resilience patterns (circuit breaker, retry, panic recovery)
- Security patterns (replay protection)
- Concurrent access (race condition prevention)
- Error handling (validation, not found, timeout)
- Service lifecycle (initialization, health, shutdown)

#### Infrastructure Tests

- AccountPool integration (12 tests)
- Crypto operations (key derivation, encryption, signing)
- Hash functions (SHA256, RIPEMD160)
- Context cancellation handling

---
