# Service Layer Code Review Checklist

## Project Overview

This is a **Service Layer** project for Neo N3 blockchain, providing TEE-based (Trusted Execution Environment) oracle services. The project uses:
- **Go 1.24** as the primary language
- **MarbleRun + EGo** for TEE enclave execution
- **Supabase** for database persistence
- **Neo N3** blockchain for on-chain interactions

## Review Execution Plan

### Phase 1: Architecture Review (Priority: HIGH)

#### 1.1 Service Structure Consistency
- [ ] Verify all 8 services follow the standard directory structure:
  ```
  services/{service}/
  ├── marble/          # Service implementation
  ├── supabase/        # Database layer (if applicable)
  ├── chain/           # On-chain interaction (if applicable)
  └── contract/        # Smart contract source (if applicable)
  ```
- [ ] Check services: `accountpool`, `automation`, `confidential`, `datafeeds`, `mixer`, `oracle`, `secrets`, `vrf`

#### 1.2 Standard File Naming
Each `marble/` directory should contain:
- [ ] `service.go` - Service struct, Config, New() constructor
- [ ] `types.go` - Request/Response types
- [ ] `handlers.go` - HTTP handlers
- [ ] `api.go` - Route registration (registerRoutes)
- [ ] `lifecycle.go` - Start/Stop methods
- [ ] `service_test.go` - Unit tests

#### 1.3 Config Pattern Consistency
Verify each service's Config struct follows the pattern:
```go
type Config struct {
    Marble       *marble.Marble
    DB           database.RepositoryInterface
    {Service}Repo {service}supabase.RepositoryInterface  // if has persistence
    ChainClient  *chain.Client                           // if has chain interaction
    // Service-specific fields...
}
```

### Phase 2: Code Quality Review (Priority: HIGH)

#### 2.1 Error Handling
- [ ] All errors are properly wrapped with context using `fmt.Errorf("context: %w", err)`
- [ ] No silent error swallowing (errors should be logged or returned)
- [ ] HTTP handlers return appropriate status codes
- [ ] Consistent error response format across all services

#### 2.2 Concurrency Safety
- [ ] Proper use of `sync.Mutex` / `sync.RWMutex` for shared state
- [ ] No data races (verify with `go test -race`)
- [ ] Proper channel usage (no goroutine leaks)
- [ ] Context cancellation is respected in long-running operations

#### 2.3 Resource Management
- [ ] All `defer` statements for cleanup (file handles, connections, locks)
- [ ] HTTP response bodies are closed: `defer resp.Body.Close()`
- [ ] Database connections are properly managed
- [ ] Background goroutines have proper shutdown mechanisms (`stopCh`)

#### 2.4 Code Style
- [ ] Consistent naming conventions (camelCase for private, PascalCase for public)
- [ ] No magic numbers (use named constants)
- [ ] Functions are reasonably sized (< 50 lines preferred)
- [ ] Comments explain "why" not "what"

### Phase 3: Security Review (Priority: CRITICAL)

#### 3.1 Secret Management
- [ ] No hardcoded secrets in source code
- [ ] Secrets loaded from Marble manifest injection
- [ ] Secret keys are properly zeroed after use where applicable
- [ ] No secrets logged or exposed in error messages

#### 3.2 Input Validation
- [ ] All HTTP inputs are validated before processing
- [ ] SQL injection prevention (parameterized queries)
- [ ] Path traversal prevention for file operations
- [ ] Integer overflow checks for financial calculations

#### 3.3 Authentication & Authorization
- [ ] Service-to-service authentication via mTLS
- [ ] User authentication tokens validated
- [ ] Authorization checks before sensitive operations
- [ ] Rate limiting implemented where appropriate

#### 3.4 Cryptographic Operations
- [ ] Using secure random number generation (`crypto/rand`)
- [ ] Proper key derivation (HKDF with appropriate parameters)
- [ ] No deprecated cryptographic algorithms
- [ ] Proper nonce/IV handling for encryption

#### 3.5 TEE-Specific Security
- [ ] Secrets derived from Marble manifest, not enclave identity (upgrade safety)
- [ ] No MRENCLAVE/MRSIGNER in key derivation paths
- [ ] Attestation properly implemented
- [ ] Sealed storage used appropriately

### Phase 4: Testing Review (Priority: HIGH)

#### 4.1 Test Coverage
- [ ] Each service has unit tests in `service_test.go`
- [ ] Critical paths have test coverage
- [ ] Edge cases are tested
- [ ] Error conditions are tested

#### 4.2 Test Quality
- [ ] Tests are independent (no shared state between tests)
- [ ] Tests use table-driven patterns where appropriate
- [ ] Mocks/stubs used for external dependencies
- [ ] Tests have meaningful assertions

#### 4.3 Integration Tests
- [ ] `test/integration/` contains service integration tests
- [ ] `test/e2e/` contains end-to-end tests
- [ ] `test/fairy/` contains Fairy-based contract tests
- [ ] Tests can run in CI environment

### Phase 5: Documentation Review (Priority: MEDIUM)

#### 5.1 Code Documentation
- [ ] Package-level documentation in each package
- [ ] Exported functions have doc comments
- [ ] Complex algorithms have explanatory comments
- [ ] TODO/FIXME comments are tracked

#### 5.2 Project Documentation
- [ ] `README.md` is up-to-date
- [ ] `docs/ARCHITECTURE.md` reflects current architecture
- [ ] Each service has its own `README.md`
- [ ] API documentation is accurate

### Phase 6: Dependency Review (Priority: MEDIUM)

#### 6.1 Go Modules
- [ ] `go.mod` has appropriate Go version
- [ ] No unnecessary dependencies
- [ ] Dependencies are up-to-date (check for vulnerabilities)
- [ ] `go.sum` is committed and consistent

#### 6.2 External Dependencies
- [ ] Neo-go version is compatible
- [ ] EGo/MarbleRun versions are compatible
- [ ] No deprecated dependencies

### Phase 7: Performance Review (Priority: LOW)

#### 7.1 Memory Usage
- [ ] No obvious memory leaks
- [ ] Large allocations are pooled where appropriate
- [ ] Slices pre-allocated when size is known

#### 7.2 Database Operations
- [ ] Queries are optimized (proper indexes assumed)
- [ ] Batch operations used where appropriate
- [ ] Connection pooling configured

#### 7.3 HTTP Operations
- [ ] Timeouts configured for all HTTP clients
- [ ] Connection reuse enabled
- [ ] Response size limits enforced

---

## Specific Files to Review

### Core Infrastructure
| File | Priority | Focus Areas |
|------|----------|-------------|
| `internal/marble/marble.go` | HIGH | TEE initialization, secret loading |
| `internal/marble/service.go` | HIGH | Base service implementation |
| `internal/chain/client.go` | HIGH | Blockchain interaction |
| `internal/chain/tee_fulfiller.go` | HIGH | TEE transaction signing |
| `internal/crypto/*.go` | CRITICAL | Cryptographic operations |
| `internal/database/*.go` | HIGH | Database abstraction |

### Services (Review Each)
| Service | Key Files | Special Focus |
|---------|-----------|---------------|
| accountpool | `service.go`, `signing.go`, `pool.go` | Key derivation, HD wallet |
| automation | `service.go`, `triggers.go`, `lifecycle.go` | Trigger execution, scheduling |
| confidential | `service.go`, `core.go` | JavaScript execution, sandboxing |
| datafeeds | `service.go`, `chainlink.go`, `config.go` | External API calls, price aggregation |
| mixer | `service.go`, `mixing.go`, `pool.go` | Privacy, proof generation |
| oracle | `service.go`, `handlers.go` | External data fetching |
| secrets | `service.go`, `handlers.go` | Encryption, access control |
| vrf | `service.go`, `core.go`, `fulfiller.go` | VRF proof generation |

### Smart Contracts
| Contract | Location | Focus |
|----------|----------|-------|
| ServiceLayerGateway | `contracts/gateway/` | Entry point, routing |
| DataFeedsService | `contracts/datafeeds/` | Price feed storage |
| VRFService | `contracts/vrf/` | VRF request/fulfill |
| MixerService | `contracts/mixer/` | Mixing proofs |
| AutomationService | `contracts/automation/` | Trigger registration |

---

## Review Commands

```bash
# Build verification
go build ./...

# Run all tests
go test ./... -v

# Run tests with race detection
go test ./... -race

# Check for common issues
go vet ./...

# Format check
gofmt -l .

# Static analysis (if golangci-lint installed)
golangci-lint run

# Check for vulnerabilities
go list -json -m all | nancy sleuth

# Generate test coverage
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

---

## Issue Severity Levels

| Level | Description | Action Required |
|-------|-------------|-----------------|
| CRITICAL | Security vulnerability, data loss risk | Must fix before merge |
| HIGH | Significant bug, performance issue | Should fix before merge |
| MEDIUM | Code quality issue, minor bug | Fix in next iteration |
| LOW | Style issue, optimization opportunity | Nice to have |

---

## Review Output Format

For each issue found, document:
```
## [SEVERITY] Issue Title

**Location**: `path/to/file.go:line_number`
**Category**: Security / Code Quality / Testing / Documentation / Performance

**Description**:
Brief description of the issue.

**Current Code**:
```go
// problematic code snippet
```

**Recommended Fix**:
```go
// suggested fix
```

**Rationale**:
Why this is an issue and why the fix is appropriate.
```

---

## Checklist Summary

### Must Pass (Blocking)
- [ ] All builds pass (`go build ./...`)
- [ ] All tests pass (`go test ./...`)
- [ ] No race conditions (`go test -race ./...`)
- [ ] No critical security issues
- [ ] No hardcoded secrets

### Should Pass (High Priority)
- [ ] Consistent service structure
- [ ] Proper error handling
- [ ] Adequate test coverage
- [ ] Documentation up-to-date

### Nice to Have
- [ ] Performance optimizations
- [ ] Additional test cases
- [ ] Code style improvements
