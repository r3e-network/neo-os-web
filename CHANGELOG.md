# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Note: this repository's **current** architecture uses a Supabase Edge gateway and a
> small set of enclave services (see `README.md` and `docs/ARCHITECTURE.md`).

## [Unreleased]

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

