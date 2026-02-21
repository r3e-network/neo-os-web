# Highest-Standard Refactoring Plan

Based on 54 findings from 4-agent parallel review (security, architecture, performance, test coverage).
Cross-validated findings marked with [XV] — independently discovered by multiple agents.

## Phase 1: Security Critical (MUST FIX)

### 1.1 [XV] Private Key Material Zeroization
- **Files**: `infrastructure/accountpool/marble/signing.go` (6 signing functions)
- **Action**: Add `defer crypto.ZeroBytes(keyBytes)` and `defer crypto.ZeroBytes(dBytes)` after every key derivation. Also zeroize hex string intermediates.
- **Pattern**: Lines 158, 242, 347, 490, 610, 754 — all follow same pattern.

### 1.2 SGX Manifest TCB Hardening
- **File**: `manifests/manifest-dev.json`
- **Action**: Create `manifests/manifest-prod.json` with only `UpToDate` and `SWHardeningNeeded`. Keep dev manifest as-is but add warning comment.

### 1.3 neosimulation Zero SignerID
- **File**: `manifests/manifest-dev.json:144`
- **Action**: Remove shared secret access from neosimulation package. Create separate non-shared secrets for simulation.

### 1.4 SSRF Protection in Oracle Service
- **Files**: `services/conforacle/marble/handlers.go`, `services/conforacle/marble/config.go`
- **Action**: Add `infrastructure/httputil/safedialer.go` with private IP blocking in DialContext. Enforce non-empty allowlist in strict mode.

### 1.5 GlobalSigner Strict Mode Enforcement
- **File**: `infrastructure/globalsigner/marble/service.go:163-169`
- **Action**: In strict mode, fail startup if domain/signRaw allowlists are empty (deny-all default).

### 1.6 [XV] Internal Error Message Leakage
- **Files**: 40+ occurrences across all `handlers.go` files
- **Action**: Replace all `httputil.InternalError(w, err.Error())` with `httputil.InternalError(w, "internal error")`. Log real error server-side.

## Phase 2: Memory Critical (SGX 512MB Heap)

### 2.1 [XV] Rate Limiter Bounded Eviction
- **File**: `infrastructure/middleware/ratelimit.go`
- **Action**: Replace nuclear 10K cleanup with LRU eviction. Track last-access time per limiter. Evict entries idle > 2x window. Cap at 5000 entries.

### 2.2 Account Pool Paginated Queries
- **Files**:
  - `infrastructure/accountpool/supabase/repository.go` — `ListLowBalanceAccounts`, `AggregateTokenStats`
  - `infrastructure/accountpool/marble/pool.go` — `rotateAccounts`, `cleanupStaleLocks`
- **Action**: Push filters to Supabase queries. For rotation: query only accounts older than RotationMinAge. For stale locks: query only locked accounts past threshold. For stats: use SQL aggregates.

### 2.3 UpsertBalance Atomic Operation
- **File**: `infrastructure/accountpool/supabase/repository.go:338-375`
- **Action**: Use Supabase `Prefer: resolution=merge-duplicates` for true upsert in one round-trip.

### 2.4 DeleteBalances Batch Operation
- **File**: `infrastructure/accountpool/supabase/repository.go:424-446`
- **Action**: Single DELETE with `account_id=eq.{id}` filter instead of N+1 deletes.

## Phase 3: Architecture Refactoring

### 3.1 [XV] Unified Error System
- **Files**: All `services/*/marble/handlers.go`, `infrastructure/errors/`
- **Action**: Adopt `infrastructure/errors.ServiceError` in all handlers. Create `httputil.WriteServiceError(w, r, err)` that maps ServiceError codes to HTTP status + structured response with trace_id.

### 3.2 Extract Shared Utilities
- **New file**: `infrastructure/runtime/env.go`
- **Action**: Extract `parseEnvInt`, `parseEnvBool`, `parseEnvDuration` from 5+ files into single location.
- **New file**: `infrastructure/chain/normalize.go`
- **Action**: Extract `normalizeContractHash` from 3 divergent implementations into single canonical version.
- **New file**: `infrastructure/config/resolve.go`
- **Action**: Extract `ResolveSecret(cfg, marble, envKeys...)` to eliminate 15+ repeated contract hash resolution patterns.

### 3.3 Decompose God Functions
- **File**: `cmd/marble/main.go` — Extract per-service factory functions from 795-line main().
- **File**: `services/requests/marble/service.go` — Split 265-line New() into `newFromConfig()`, `wireEventHandlers()`, `registerWorkers()`.

### 3.4 API Consistency
- Standardize all services to use `api.go` with `registerRoutes()`.
- Use `http.Method*` constants everywhere.
- Use `httputil.WriteErrorResponse` (with trace_id) everywhere instead of `WriteError`.
- Use `httputil.PaginationParams` consistently (fix gasbank hardcoded limit).

### 3.5 Fat Interface Decomposition
- **File**: `infrastructure/database/repository_interface.go`
- **Action**: Services accept only sub-interfaces they need. `BaseConfig.DB` becomes `database.BaseRepository`.

### 3.6 Middleware Cleanup
- **File**: `infrastructure/middleware/serviceauth.go`
- **Action**: Remove re-exports of `serviceauth.*`. Consumers import `serviceauth` directly.

## Phase 4: Performance Optimization

### 4.1 Cache Derived Signing Keys
- **File**: `services/datafeed/marble/core.go:304-335`
- **Action**: Derive signing key once at init, cache `*ecdsa.PrivateKey`.

### 4.2 Eliminate Redundant DB Calls in Signing
- **File**: `infrastructure/accountpool/marble/service.go:295-316`
- **Action**: Pass already-fetched Account to `getPrivateKey` instead of re-fetching.

### 4.3 Reuse HTTP Clients
- **File**: `services/gasbank/marble/topup.go:173-185`
- **Action**: Create accountpool client once at service init, store as field.

### 4.4 Reduce Mutex Scope in Pool Operations
- **File**: `infrastructure/accountpool/marble/pool.go:25-152`
- **Action**: Use optimistic locking via DB-level atomic lock. Remove service-level mutex from RequestAccounts/ReleaseAccounts.

### 4.5 Price Feed Caching
- **File**: `services/datafeed/marble/core.go`
- **Action**: Cache last price per feed with 10-30s TTL. Return cached value if within TTL.

### 4.6 Event Listener Graceful Shutdown
- **File**: `infrastructure/chain/listener_core.go:334-356`
- **Action**: Add sync.WaitGroup to track in-flight handlers. Wait with timeout on Stop().

### 4.7 MiniApp Cache Bounded Eviction
- **File**: `services/requests/marble/miniapp_cache.go`
- **Action**: Add periodic cleanup worker for expired entries.

### 4.8 String Builder in Query Builder
- **File**: `infrastructure/database/generic_repository.go:250-301`
- **Action**: Replace string concatenation with `strings.Builder`. Replace custom `joinStrings` with `strings.Join`.

## Phase 5: Additional Security Hardening

### 5.1 AES-GCM with AAD
- **File**: `infrastructure/crypto/crypto.go:76-94`
- **Action**: Add context/purpose parameter to `Encrypt()` as AAD, or migrate callers to `EncryptEnvelope()`.

### 5.2 NeoCompute JS Sandbox Hardening
- **File**: `services/confcompute/marble/core.go:219-353`
- **Action**: Set `vm.SetMaxCallStackSize()`. Sanitize console.log output to prevent secret exfiltration via logs.

### 5.3 CORS Wildcard + Credentials Guard
- **File**: `infrastructure/middleware/cors.go:52-58`
- **Action**: Reject wildcard origins when AllowCredentials is true.

### 5.4 Master Key Caching
- **File**: `infrastructure/accountpool/marble/signing.go:855-876`
- **Action**: Load and cache master wallet account once at init. Zeroize raw key string after parsing.

## Execution Order

Priority: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
Within each phase, items are ordered by impact.

## Estimated Scope

| Phase | Files Modified | New Files | Risk |
|-------|---------------|-----------|------|
| 1 | ~15 | 2 | HIGH (security-critical) |
| 2 | ~5 | 0 | MEDIUM (query changes) |
| 3 | ~25 | 3 | MEDIUM (structural) |
| 4 | ~10 | 0 | LOW (optimization) |
| 5 | ~5 | 0 | MEDIUM (security) |
