# Codebase Simplification Plan

Complements `refactor-plan.md`. Focuses on configuration deduplication, cleanup, CI hardening, and test coverage.

## Phase 1: Cleanup & Hygiene

### 1.1 Remove temporary root files
- Delete all `fix_*.go`, `test_*.go`, `try_keys.go`, `parse_quote.go`, `get_pool_enc_key.go` from project root (~30 files)
- Delete build artifacts: `coord.tar`, `coordinator-config.json`, `coordinator-enclave.signed`
- Delete `start.sh`, `test-era.json`
- Add patterns to `.gitignore`: `fix_*.go`, `test_*.go`, `*.tar`, `coordinator-*`

### 1.2 Resolve TODO comments
- `platform/host-app/lib/server-supabase.ts:1` — generate typed Database or remove TODO

## Phase 2: Docker Compose Deduplication

### 2.1 Production docker-compose.yaml
- Extract YAML anchors for repeated service config (build args, env vars, volumes, healthchecks, resource limits)
- Define `x-service-defaults` anchor with shared configuration
- Each service merges via `<<: *service-defaults` and overrides only `SERVICE_TYPE` and port

### 2.2 Local Nitro docker-compose.nitro.yaml
- Same anchor pattern adapted for local Nitro mode
- Standardize healthchecks (currently mix of HTTPS wget and TCP bash)

## Phase 3: Manifest & Config Simplification

### 3.1 Extract contract hashes
- Move 60+ `CONTRACT_MINIAPP_*_HASH` entries from `manifests/manifest.json` to `config/contract-hashes.json`
- Load at runtime via config package instead of environment variables
- Reduces manifest from ~230 lines of hashes to a single config reference

### 3.2 Remove hardcoded test keys
- `manifests/manifest.json:40-41` — replace `POOL_ENCRYPTION_KEY` and `POOL_MASTER_KEY` with MarbleRun secret templating (`{{ hex .Secrets.* }}`)
- Create `manifests/manifest-dev.json` with test keys for local development only

### 3.3 Consolidate K8s overlays
- Remove simulation-named overlays and keep Nitro-oriented environment naming (`dev`/`staging`/`prod`)
- Merge `production` + `production-hardened` → `prod` (with hardening as default)
- Keep `nitro-prod` as `staging`
- Result: 3 overlays (dev/staging/prod) instead of 6

## Phase 4: CI/CD Hardening

### 4.1 Fix security scan error handling
- `.github/workflows/ci.yml:303,318,324` — remove `continue-on-error: true` from security scan jobs
- Add explicit severity thresholds instead (fail on HIGH/CRITICAL)

### 4.2 Add dependency caching
- Add Node.js dependency caching (npm ci with cache)
- Add .NET dependency caching for contract builds

## Phase 5: Test Consistency & Coverage

### 5.1 Unify test framework
- Migrate `platform/admin-console` from Vitest to Jest (matching host-app) OR vice versa — pick one
- Standardize naming to `.test.ts` everywhere

### 5.2 Critical test gaps
- `services/confcompute/marble/` — add service logic tests
- `services/conforacle/marble/` — add service logic tests
- `services/requests/marble/dispatcher.go` — add tests for handleServiceRequested branches
- `infrastructure/security/` — expand beyond sanitization

### 5.3 Frontend component tests
- Add tests for shared UI components in `platform/host-app`
- Add basic render tests for key pages

## Phase 6: Code Simplification

### 6.1 Refactor dispatcher complexity
- `services/requests/marble/dispatcher.go` — extract repeated error-handling pattern into helper
- Reduce nesting from 5+ levels to 2-3

### 6.2 Standardize error handling
- Audit all `handlers.go` files for silent error swallowing
- Establish pattern: return errors for request-scoped failures, log-only for background/best-effort operations
- Document the convention

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phases 1-4 are independent and can be parallelized across agents.
Phase 5 depends on Phase 1 (clean workspace).
Phase 6 depends on Phase 5 (tests must exist before refactoring).

## Agent Team Assignment

| Agent | Phases | Focus |
|-------|--------|-------|
| cleanup-agent | 1 | File cleanup, .gitignore |
| config-agent | 2, 3 | Docker, manifest, K8s simplification |
| ci-agent | 4 | CI/CD hardening |
| test-agent | 5 | Test unification and coverage |
| refactor-agent | 6 | Code simplification |
