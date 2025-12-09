# Service Layer Code Review Execution Plan

## Instructions for Codex

This document provides a step-by-step execution plan for reviewing the Service Layer codebase. Follow each step sequentially and document findings.

---

## Step 1: Environment Verification

### 1.1 Verify Build
```bash
cd /home/neo/git/service_layer
go build ./...
```
**Expected**: No errors
**If fails**: Document build errors before proceeding

### 1.2 Verify Tests
```bash
go test ./... -short
```
**Expected**: All tests pass
**If fails**: Document failing tests

### 1.3 Check Go Version
```bash
go version
cat go.mod | head -5
```
**Expected**: Go 1.24.x, go.mod specifies go 1.24.9

---

## Step 2: Service Structure Audit

### 2.1 List All Services
```bash
ls -la services/
```
**Expected services**: accountpool, automation, confidential, datafeeds, mixer, oracle, secrets, vrf

### 2.2 Verify Each Service Structure
For each service, verify the marble/ directory contains required files:

```bash
for svc in accountpool automation confidential datafeeds mixer oracle secrets vrf; do
  echo "=== $svc ==="
  ls services/$svc/marble/*.go 2>/dev/null | xargs -n1 basename
  echo ""
done
```

**Required files per service**:
- `service.go` - Service definition
- `types.go` - Type definitions
- `handlers.go` - HTTP handlers
- `api.go` - Route registration
- `lifecycle.go` - Start/Stop methods
- `service_test.go` - Unit tests

**Document any missing files**.

### 2.3 Verify Optional Directories
```bash
for svc in accountpool automation confidential datafeeds mixer oracle secrets vrf; do
  echo "=== $svc ==="
  ls -d services/$svc/*/ 2>/dev/null | xargs -n1 basename
done
```

**Expected optional directories**:
- `supabase/` - Database layer (services with persistence)
- `chain/` - On-chain interaction (services with blockchain calls)
- `contract/` - Smart contract source (services with on-chain components)

---

## Step 3: Code Pattern Review

### 3.1 Service Constants Pattern
Check each service defines standard constants:

```bash
for svc in accountpool automation confidential datafeeds mixer oracle secrets vrf; do
  echo "=== $svc ==="
  grep -E "ServiceID|ServiceName|Version" services/$svc/marble/service.go | head -5
done
```

**Expected pattern**:
```go
const (
    ServiceID   = "{service}"
    ServiceName = "{Service} Service"
    Version     = "x.y.z"
)
```

### 3.2 Config Struct Pattern
Check each service has proper Config struct:

```bash
for svc in accountpool automation confidential datafeeds mixer oracle secrets vrf; do
  echo "=== $svc ==="
  grep -A 20 "^type Config struct" services/$svc/marble/service.go
done
```

**Expected fields**:
- `Marble *marble.Marble` - Required
- `DB database.RepositoryInterface` - If has persistence
- `{Service}Repo` - Service-specific repository
- `ChainClient *chain.Client` - If has chain interaction

### 3.3 Constructor Pattern
Check each service has proper New() function:

```bash
for svc in accountpool automation confidential datafeeds mixer oracle secrets vrf; do
  echo "=== $svc ==="
  grep -A 5 "^func New" services/$svc/marble/service.go
done
```

**Expected pattern**:
```go
func New(cfg Config) (*Service, error) {
    base := marble.NewService(marble.ServiceConfig{...})
    // ...
    s.registerRoutes()
    return s, nil
}
```

---

## Step 4: Security Audit

### 4.1 Check for Hardcoded Secrets
```bash
grep -rn "password\|secret\|apikey\|api_key\|token" --include="*.go" . | grep -v "_test.go" | grep -v "// " | head -30
```
**Expected**: No hardcoded credential values

### 4.2 Check Secret Loading Pattern
```bash
grep -rn "Marble.Secret" services/*/marble/*.go
```
**Expected**: Secrets loaded from Marble manifest

### 4.3 Check Key Derivation
```bash
grep -rn "DeriveKey\|HKDF" internal/crypto/*.go services/*/marble/*.go
```
**Verify**: No MRENCLAVE/MRSIGNER in derivation paths

### 4.4 Check Input Validation
```bash
grep -rn "json.Unmarshal\|json.NewDecoder" services/*/marble/handlers.go
```
**Verify**: Input validation after unmarshaling

### 4.5 Check SQL Injection Prevention
```bash
grep -rn "fmt.Sprintf.*SELECT\|fmt.Sprintf.*INSERT\|fmt.Sprintf.*UPDATE" services/*/supabase/*.go
```
**Expected**: No string concatenation in SQL queries

---

## Step 5: Error Handling Audit

### 5.1 Check Error Wrapping
```bash
grep -rn "return err$" services/*/marble/*.go | wc -l
grep -rn 'return fmt.Errorf.*%w' services/*/marble/*.go | wc -l
```
**Verify**: Most errors are wrapped with context

### 5.2 Check HTTP Error Responses
```bash
grep -rn "http.Error\|WriteHeader\|httputil" services/*/marble/handlers.go
```
**Verify**: Consistent error response format

### 5.3 Check Silent Error Swallowing
```bash
grep -rn "_ = err\|if err != nil {\s*$" services/*/marble/*.go
```
**Expected**: No silent error swallowing

---

## Step 6: Concurrency Audit

### 6.1 Check Mutex Usage
```bash
grep -rn "sync.Mutex\|sync.RWMutex" services/*/marble/*.go
```
**Verify**: Proper locking for shared state

### 6.2 Check Channel Usage
```bash
grep -rn "make(chan\|<-\|stopCh" services/*/marble/*.go
```
**Verify**: Channels properly closed, no goroutine leaks

### 6.3 Run Race Detector
```bash
go test ./services/... -race -short
```
**Expected**: No race conditions detected

---

## Step 7: Resource Management Audit

### 7.1 Check HTTP Response Body Closing
```bash
grep -rn "http.Client\|httpClient.Do" services/*/marble/*.go
grep -rn "defer.*Body.Close" services/*/marble/*.go
```
**Verify**: All response bodies are closed

### 7.2 Check Context Usage
```bash
grep -rn "context.Context\|ctx context" services/*/marble/*.go | head -20
```
**Verify**: Context passed through call chains

### 7.3 Check Timeout Configuration
```bash
grep -rn "Timeout\|time.Second\|time.Minute" services/*/marble/*.go | head -20
```
**Verify**: Timeouts configured for external calls

---

## Step 8: Test Coverage Audit

### 8.1 Run Tests with Coverage
```bash
go test ./services/... -coverprofile=coverage.out -short
go tool cover -func=coverage.out | tail -20
```
**Document**: Coverage percentage per package

### 8.2 Check Test Quality
```bash
for svc in accountpool automation confidential datafeeds mixer oracle secrets vrf; do
  echo "=== $svc ==="
  grep -c "func Test" services/$svc/marble/service_test.go 2>/dev/null || echo "0 tests"
done
```
**Document**: Number of test functions per service

---

## Step 9: Documentation Audit

### 9.1 Check Package Documentation
```bash
for svc in accountpool automation confidential datafeeds mixer oracle secrets vrf; do
  echo "=== $svc ==="
  head -10 services/$svc/marble/service.go | grep -E "^// Package"
done
```
**Verify**: Each package has documentation

### 9.2 Check README Files
```bash
ls services/*/README.md 2>/dev/null
```
**Verify**: Each service has README.md

### 9.3 Check Architecture Documentation
```bash
ls docs/*.md 2>/dev/null
cat docs/ARCHITECTURE.md | head -50
```
**Verify**: Architecture documentation exists and is current

---

## Step 10: Dependency Audit

### 10.1 Check Direct Dependencies
```bash
grep -A 20 "^require (" go.mod | grep -v "//"
```
**Document**: List of direct dependencies

### 10.2 Check for Vulnerabilities
```bash
go list -json -m all 2>/dev/null | head -100
```
**Note**: Run `govulncheck` if available

### 10.3 Check Dependency Versions
```bash
grep "neo-go\|ego\|supabase" go.mod
```
**Verify**: Critical dependencies are up-to-date

---

## Step 11: Smart Contract Audit

### 11.1 List Contract Files
```bash
find contracts/ -name "*.cs" | head -30
```

### 11.2 Check Contract Build Artifacts
```bash
ls contracts/build/*.nef contracts/build/*.manifest.json 2>/dev/null
```
**Verify**: Contracts are compiled

### 11.3 Review Gateway Contract
```bash
cat contracts/gateway/ServiceLayerGateway.cs | head -100
```
**Focus**: Entry point logic, access control

---

## Step 12: Integration Points Audit

### 12.1 Check Internal Package Dependencies
```bash
ls internal/
for pkg in chain crypto database marble; do
  echo "=== internal/$pkg ==="
  ls internal/$pkg/*.go 2>/dev/null | xargs -n1 basename
done
```

### 12.2 Check Service-to-Service Communication
```bash
grep -rn "http.Client\|httpClient" services/*/marble/*.go | grep -v "_test.go"
```
**Verify**: mTLS used for inter-service calls

---

## Review Output Template

After completing all steps, generate a report using this template:

```markdown
# Service Layer Code Review Report

**Date**: YYYY-MM-DD
**Reviewer**: Codex
**Commit**: [commit hash]

## Executive Summary
[Brief overview of findings]

## Build Status
- [ ] Build passes
- [ ] Tests pass
- [ ] Race detection passes

## Critical Issues
[List any CRITICAL severity issues]

## High Priority Issues
[List any HIGH severity issues]

## Medium Priority Issues
[List any MEDIUM severity issues]

## Low Priority Issues
[List any LOW severity issues]

## Recommendations
[Prioritized list of recommendations]

## Metrics
- Total services reviewed: 8
- Test coverage: X%
- Issues found: X (Critical: X, High: X, Medium: X, Low: X)
```

---

## Quick Reference Commands

```bash
# Full build
go build ./...

# All tests
go test ./... -v

# Race detection
go test ./... -race

# Coverage report
go test ./... -coverprofile=coverage.out && go tool cover -html=coverage.out

# Find TODOs
grep -rn "TODO\|FIXME\|XXX" --include="*.go" .

# Check formatting
gofmt -l .

# Vet check
go vet ./...
```
