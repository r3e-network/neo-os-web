# Service Layer Developer Guide

Comprehensive guide for developers building on or extending the Neo N3 Service Layer.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Creating Services](#creating-services)
4. [Service Engine (V2)](#service-engine-v2)
5. [Framework Components](#framework-components)
6. [Platform Drivers](#platform-drivers)
7. [Testing](#testing)
8. [Best Practices](#best-practices)

---

## Architecture Overview

### Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION                                     │
│                    (HTTP API, CLI, Dashboard)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SERVICES LAYER                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ accounts │ │functions │ │  oracle  │ │ gasbank  │ │    ...   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  Location: packages/com.r3e.services.*/                                     │
│  Purpose: Domain-specific business logic                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ENGINE LAYER (OS Kernel)                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Registry │ │Lifecycle │ │   Bus    │ │  Health  │ │ Recovery │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  Location: system/core/                                                     │
│  Purpose: Service orchestration, lifecycle, communication                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRAMEWORK LAYER (SDK)                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Base    │ │ Builder  │ │ Manifest │ │   Bus    │ │ Testing  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  Location: system/framework/                                                │
│  Purpose: Service development SDK and utilities                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLATFORM LAYER (Drivers)                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │   RPC    │ │ Storage  │ │  Cache   │ │  Queue   │ │  Crypto  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  Location: system/platform/                                                 │
│  Purpose: Infrastructure abstraction (HAL)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Location | Responsibility |
|-------|----------|---------------|
| **Platform** | `system/platform/` | Hardware abstraction, drivers |
| **Framework** | `system/framework/` | Service development SDK |
| **Engine** | `system/core/` | Lifecycle, bus, health, recovery |
| **Services** | `packages/com.r3e.services.*/` | Business logic (17 domains) |

### Service Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICES                                  │
├──────────────────┬──────────────────┬───────────────────────────┤
│   User-Facing    │   Data Services  │    Infrastructure         │
├──────────────────┼──────────────────┼───────────────────────────┤
│ • accounts       │ • oracle         │ • gasbank                 │
│ • functions      │ • datafeeds      │ • secrets                 │
│ • automation     │ • pricefeed      │ • random                  │
│ • triggers       │ • datastreams    │ • vrf                     │
│                  │ • datalink       │ • confidential            │
├──────────────────┴──────────────────┴───────────────────────────┤
│   Cross-Chain          │    Compute           │   Trading       │
├────────────────────────┼──────────────────────┼─────────────────┤
│ • ccip                 │ • cre                │ • dta           │
└────────────────────────┴──────────────────────┴─────────────────┘
```

---

## Getting Started

### Prerequisites

```bash
# Go 1.24+
go version

# Clone repository
git clone https://github.com/R3E-Network/service_layer.git
cd service_layer

# Install dependencies
go mod download
# Node.js 20+ (use `nvm use` from repo root to match CI)
nvm use 2>/dev/null || true
```

### Project Structure

```
service_layer/
├── cmd/                    # Entry points
│   ├── appserver/          # Main HTTP server
│   ├── slctl/              # CLI tool
│   └── neo-indexer/        # NEO blockchain indexer
├── system/                 # System layer (Android OS equivalent)
│   ├── core/               # Service engine interfaces
│   ├── framework/          # Service SDK (ServiceBase, Manifest, Bus)
│   ├── platform/           # Platform drivers (database, migrations)
│   ├── runtime/            # Runtime adapters
│   └── bootstrap/          # Application bootstrap
├── packages/               # Service packages (Android Apps equivalent)
│   └── com.r3e.services.*/ # 17 business services
├── applications/           # Application composition layer
│   ├── httpapi/            # HTTP handlers
│   └── storage/            # Storage implementations
├── domain/                 # Domain models
├── pkg/                    # Shared utilities
├── docs/                   # Documentation
├── examples/               # Code examples
└── apps/dashboard/         # React dashboard
```

### Running Locally

```bash
# Supabase Postgres (required)
export API_TOKENS=dev-token
export DATABASE_URL="postgres://supabase_admin:supabase_pass@supabase-postgres:5432/service_layer?sslmode=disable"
export SUPABASE_JWT_SECRET="***REMOVED***"   # validate GoTrue JWTs; reused by /auth/login when AUTH_JWT_SECRET is empty
export SUPABASE_JWT_AUD="authenticated"         # optional; defaults to Supabase audience
export SUPABASE_ADMIN_ROLES="service_role,admin" # optional; map Supabase roles to Service Layer admin
export SUPABASE_TENANT_CLAIM="app_metadata.tenant" # optional; map tenant from JWT when X-Tenant-ID missing
export SUPABASE_GOTRUE_URL="http://supabase-gotrue:9999" # required with Supabase JWTs for /auth/refresh
export SUPABASE_HEALTH_URL="http://supabase-gotrue:9999/health" # optional; reported in /system/status
export SUPABASE_HEALTH_GOTRUE="http://supabase-gotrue:9999/health"
export SUPABASE_HEALTH_POSTGREST="http://supabase-postgrest:3000"
export SUPABASE_HEALTH_KONG="http://supabase-kong:8000/health"
export SUPABASE_HEALTH_STUDIO="http://supabase-studio:3000"
export SUPABASE_ROLE_CLAIM="app_metadata.role" # optional; derive role from JWT claim before admin mapping
go run ./cmd/appserver -dsn "$DATABASE_URL" -migrate

# Full stack with Docker (Supabase profile included)
make run
# or
docker compose --profile supabase up -d --build
```

Notes:
- `docs/supabase-setup.md` covers the Supabase profile (Postgres + GoTrue/PostgREST/Kong/Studio) and the auth/env matrix (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_GOTRUE_URL`).
- On-chain helpers live in `examples/neo-privnet-contract*` with a companion guide in `docs/blockchain-contracts.md`; use the typed clients in `sdk/typescript/client` or `sdk/go/client` (both support Supabase refresh tokens) for service automation.

---

## Creating Services

### Service Interface

Every service must implement the base interface:

```go
type Service interface {
    Name() string                      // Unique service name
    Domain() string                    // Service domain/category
    Start(ctx context.Context) error   // Lifecycle start
    Stop(ctx context.Context) error    // Lifecycle stop
    Ready(ctx context.Context) error   // Readiness check
}
```

### Minimal Service Example

```go
package myservice

import (
    "context"
    "github.com/R3E-Network/service_layer/system/framework"
    "github.com/R3E-Network/service_layer/system/framework/core"
)

type Service struct {
    framework.ServiceBase  // Embed base functionality
    store  MyStore
    log    *logger.Logger
}

func New(store MyStore, log *logger.Logger) *Service {
    svc := &Service{
        store: store,
        log:   log,
    }
    svc.SetName(svc.Name())
    return svc
}

// Required interface methods
func (s *Service) Name() string   { return "myservice" }
func (s *Service) Domain() string { return "custom" }

func (s *Service) Start(ctx context.Context) error {
    s.MarkReady(true)
    s.log.Info("myservice started")
    return nil
}

func (s *Service) Stop(ctx context.Context) error {
    s.MarkReady(false)
    s.log.Info("myservice stopped")
    return nil
}

func (s *Service) Ready(ctx context.Context) error {
    return s.ServiceBase.Ready(ctx)
}

// Service descriptor for discovery
func (s *Service) Descriptor() core.Descriptor {
    return core.Descriptor{
        Name:         s.Name(),
        Domain:       s.Domain(),
        Layer:        core.LayerService,
        Capabilities: []string{"custom-capability"},
        DependsOn:    []string{"store"},
    }
}

// Business methods
func (s *Service) DoSomething(ctx context.Context, input string) (string, error) {
    // Implementation
    return "result", nil
}
```

### Service Manifest

Define service metadata and dependencies:

```go
func (s *Service) Manifest() *framework.Manifest {
    return &framework.Manifest{
        Name:         s.Name(),
        Domain:       s.Domain(),
        Description:  "My custom service",
        Layer:        "service",
        DependsOn:    []string{"store", "svc-accounts"},
        RequiresAPIs: []engine.APISurface{
            engine.APISurfaceStore,
            engine.APISurfaceEvent,
        },
        Capabilities: []string{"custom-cap"},
        Quotas:       map[string]string{"rpc": "myservice-quota"},
    }
}
```

### Health Check Implementation

```go
func (s *Service) HealthCheck(ctx context.Context) core.HealthCheck {
    hc := core.NewHealthCheck(s.Name())

    // Check store connectivity
    storeCheck := core.CheckStore(ctx, "myservice-store", func(ctx context.Context) error {
        _, err := s.store.List(ctx, "")
        return err
    })
    hc = hc.WithComponent(storeCheck)

    // Check external dependency
    if s.externalClient != nil {
        extCheck := core.ComponentCheck{
            Name:   "external-api",
            Status: core.StatusHealthy,
        }
        if err := s.externalClient.Ping(ctx); err != nil {
            extCheck.Status = core.StatusUnhealthy
            extCheck.Message = err.Error()
        }
        hc = hc.WithComponent(extCheck)
    }

    return hc
}
```

---

## Service Engine (V2)

The Service Engine V2 provides an automated workflow for contract event handling with explicit method declarations.

### Method Types

| Type | Description | Callback |
|------|-------------|----------|
| `init` | Called once at service deployment | None |
| `invoke` | Standard method called by contract events | Required/Optional |
| `view` | Read-only method, no state changes | None |
| `admin` | Administrative method requiring elevated permissions | Optional |

### Callback Modes

| Mode | Description |
|------|-------------|
| `none` | No callback sent (void method) |
| `required` | Callback MUST be sent with result |
| `optional` | Callback sent only if result is non-nil |
| `on_error` | Callback sent only on error |

### Creating a V2 Service

```go
package myservice

import (
    "context"
    "github.com/R3E-Network/service_layer/system/framework"
)

type MyServiceV2 struct {
    registry    *framework.ServiceMethodRegistry
    initialized bool
}

func NewMyServiceV2() *MyServiceV2 {
    svc := &MyServiceV2{}
    svc.registry = svc.buildRegistry()
    return svc
}

func (s *MyServiceV2) ServiceName() string {
    return "myservice"
}

func (s *MyServiceV2) MethodRegistry() *framework.ServiceMethodRegistry {
    return s.registry
}

func (s *MyServiceV2) buildRegistry() *framework.ServiceMethodRegistry {
    builder := framework.NewMethodRegistryBuilder("myservice")

    // Init method - called once at deployment
    builder.WithInit(
        framework.NewMethod("init").
            AsInit().
            WithDescription("Initialize service").
            WithOptionalParam("config", "map", "Configuration", nil).
            Build(),
    )

    // Invoke method - sends callback with result
    builder.WithMethod(
        framework.NewMethod("process").
            WithDescription("Process a request").
            RequiresCallback().
            WithDefaultCallbackMethod("fulfill").
            WithParam("data", "string", "Input data").
            WithMaxExecutionTime(30000).
            Build(),
    )

    // View method - no callback
    builder.WithMethod(
        framework.NewMethod("getStatus").
            AsView().
            WithDescription("Get status").
            Build(),
    )

    return builder.Build()
}

// Initialize is called once when the service is deployed
func (s *MyServiceV2) Initialize(ctx context.Context, params map[string]any) error {
    if s.initialized {
        return fmt.Errorf("already initialized")
    }
    s.initialized = true
    return nil
}

// Invoke calls a method with parameters
func (s *MyServiceV2) Invoke(ctx context.Context, method string, params map[string]any) (any, error) {
    switch method {
    case "process":
        return s.process(ctx, params)
    case "getStatus":
        return s.getStatus(ctx, params)
    default:
        return nil, fmt.Errorf("unknown method: %s", method)
    }
}

func (s *MyServiceV2) process(ctx context.Context, params map[string]any) (any, error) {
    data, _ := params["data"].(string)
    // Process and return result - callback sent automatically
    return map[string]any{"result": data, "timestamp": time.Now().Unix()}, nil
}

func (s *MyServiceV2) getStatus(ctx context.Context, params map[string]any) (any, error) {
    // View method - no callback sent
    return map[string]any{"initialized": s.initialized}, nil
}
```

### Contract Event Format

```json
{
  "id": "request-123",
  "service": "myservice",
  "method": "process",
  "params": {"data": "input"},
  "callback_contract": "0x1234...",
  "callback_method": "fulfill"
}
```

For complete documentation, see [Service Engine Guide](service-engine.md).

---

## Framework Components

### ServiceBase

Provides common functionality for all services:

```go
type ServiceBase struct {
    name     string
    ready    atomic.Bool
    started  time.Time
    stopped  time.Time
}

// Methods
func (b *ServiceBase) SetName(name string)
func (b *ServiceBase) MarkReady(ready bool)
func (b *ServiceBase) IsReady() bool
func (b *ServiceBase) Ready(ctx context.Context) error
func (b *ServiceBase) StartTime() time.Time
func (b *ServiceBase) StopTime() time.Time
func (b *ServiceBase) Uptime() time.Duration
```

### Core Utilities

Located in `system/framework/core/`:

#### Base Validation

```go
// Validate account exists
base := core.NewBase(accountStore)
if err := base.EnsureAccount(ctx, accountID); err != nil {
    return fmt.Errorf("account validation: %w", err)
}
```

#### Dispatch Pattern

```go
// Dispatcher for background processing
type Dispatcher struct {
    queue    chan Request
    workers  int
    handler  func(context.Context, Request) error
}

dispatcher := core.NewDispatcher(10, handleRequest)
dispatcher.Start(ctx)
defer dispatcher.Stop(ctx)

dispatcher.Submit(ctx, request)
```

#### Retry Logic

```go
// Retry with exponential backoff
result, err := core.Retry(ctx, core.RetryConfig{
    MaxAttempts: 3,
    BaseDelay:   100 * time.Millisecond,
    MaxDelay:    5 * time.Second,
    Multiplier:  2.0,
}, func() (interface{}, error) {
    return doOperation()
})
```

#### Observation Hooks

```go
// Instrument operations
hooks := core.ObservationHooks{
    OnStart: func(ctx context.Context, attrs map[string]string) {
        metrics.Increment("operation_started", attrs)
    },
    OnComplete: func(ctx context.Context, attrs map[string]string, err error) {
        if err != nil {
            metrics.Increment("operation_failed", attrs)
        } else {
            metrics.Increment("operation_succeeded", attrs)
        }
    },
}

svc.WithObservationHooks(hooks)
```

#### Tracer Integration

```go
// Distributed tracing
tracer := core.NewTracer("myservice")
ctx, finish := tracer.StartSpan(ctx, "operation", map[string]string{
    "account_id": accountID,
})
defer finish(nil)

// Do work...
```

#### Pagination Helpers

```go
// Clamp pagination parameters
limit := core.ClampLimit(requestLimit, core.DefaultListLimit, core.MaxListLimit)
offset := core.ClampOffset(requestOffset, 0, core.MaxOffset)
```

---

## Platform Drivers

### Storage Interface

```go
// applications/storage/interfaces.go
type MyStore interface {
    Create(ctx context.Context, item Item) (Item, error)
    Update(ctx context.Context, item Item) (Item, error)
    Get(ctx context.Context, id string) (Item, error)
    List(ctx context.Context, filter string) ([]Item, error)
    Delete(ctx context.Context, id string) error
}
```

### Memory Implementation

```go
// applications/storage/memory.go
type Store struct {
    mu    sync.RWMutex
    items map[string]Item
}

func (s *Store) Create(ctx context.Context, item Item) (Item, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    if item.ID == "" {
        item.ID = uuid.NewString()
    }
    item.CreatedAt = time.Now().UTC()
    s.items[item.ID] = item
    return item, nil
}
```

### PostgreSQL Implementation

```go
// applications/storage/postgres/store_myservice.go
func (s *Store) Create(ctx context.Context, item Item) (Item, error) {
    if item.ID == "" {
        item.ID = uuid.NewString()
    }
    now := time.Now().UTC()
    item.CreatedAt = now
    item.UpdatedAt = now
    tenant := s.accountTenant(ctx, item.AccountID)

    _, err := s.db.ExecContext(ctx, `
        INSERT INTO my_items (id, account_id, name, tenant, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, item.ID, item.AccountID, item.Name, tenant, item.CreatedAt, item.UpdatedAt)

    if err != nil {
        return Item{}, err
    }
    return item, nil
}
```

### Adding Migrations

```sql
-- system/platform/migrations/NNNN_my_feature.sql

-- +migrate Up
CREATE TABLE my_items (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES app_accounts(id),
    name VARCHAR(255) NOT NULL,
    tenant VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_my_items_account ON my_items(account_id);
CREATE INDEX idx_my_items_tenant ON my_items(tenant);

-- +migrate Down
DROP TABLE IF EXISTS my_items;
```

---

## Testing

### Unit Tests

```go
// packages/com.r3e.services.myservice/service_test.go
func TestService_DoSomething(t *testing.T) {
    store := memory.New()
    acct, err := store.CreateAccount(context.Background(), account.Account{
        Owner: "test",
    })
    if err != nil {
        t.Fatalf("create account: %v", err)
    }

    svc := New(store, nil)

    result, err := svc.DoSomething(context.Background(), "input")
    if err != nil {
        t.Fatalf("do something: %v", err)
    }

    if result != "expected" {
        t.Errorf("expected 'expected', got '%s'", result)
    }
}
```

### Integration Tests

```go
// applications/httpapi/integration_test.go
func TestIntegration_MyService(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }

    // Setup
    app := setupTestApp(t)
    defer app.Shutdown()

    // Create account
    acct := createTestAccount(t, app)

    // Test API
    req := httptest.NewRequest("POST", "/accounts/"+acct.ID+"/myservice",
        strings.NewReader(`{"name":"test"}`))
    req.Header.Set("Authorization", "Bearer test-token")
    req.Header.Set("Content-Type", "application/json")

    rr := httptest.NewRecorder()
    app.Handler.ServeHTTP(rr, req)

    if rr.Code != http.StatusCreated {
        t.Errorf("expected 201, got %d: %s", rr.Code, rr.Body.String())
    }
}
```

### Table-Driven Tests

```go
func TestService_Validation(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
        errMsg  string
    }{
        {"valid input", "good", false, ""},
        {"empty input", "", true, "input required"},
        {"too long", strings.Repeat("x", 1000), true, "input too long"},
    }

    svc := New(memory.New(), nil)

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := svc.Process(context.Background(), tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("wantErr=%v, got err=%v", tt.wantErr, err)
            }
            if tt.wantErr && err != nil && !strings.Contains(err.Error(), tt.errMsg) {
                t.Errorf("expected error containing '%s', got '%s'", tt.errMsg, err.Error())
            }
        })
    }
}
```

### Running Tests

```bash
# All tests
go test ./...

# Specific package
go test ./packages/com.r3e.services.myservice/...

# With coverage
go test -cover ./packages/...

# Verbose
go test -v ./packages/com.r3e.services.myservice/...

# Integration tests (requires running API)
go test -tags integration ./applications/httpapi/...

# TypeScript SDK (builds dist via pretest hook)
npm run test:sdk
```

---

## Best Practices

### Code Organization

1. **Single Responsibility**: Each service handles one domain
2. **Interface Segregation**: Define minimal interfaces
3. **Dependency Injection**: Pass dependencies via constructors
4. **Configuration**: Use environment variables or config files

### Error Handling

```go
// Use typed errors
var (
    ErrNotFound      = errors.New("not found")
    ErrUnauthorized  = errors.New("unauthorized")
    ErrValidation    = errors.New("validation failed")
)

// Wrap errors with context
if err != nil {
    return fmt.Errorf("create item: %w", err)
}

// Check error types
if errors.Is(err, ErrNotFound) {
    return http.StatusNotFound
}
```

### Logging

```go
// Use structured logging
s.log.WithField("account_id", accountID).
    WithField("item_id", itemID).
    Info("item created")

// Log errors with context
s.log.WithError(err).
    WithField("operation", "create").
    Error("operation failed")
```

### Context Usage

```go
// Always pass context
func (s *Service) DoWork(ctx context.Context, ...) error {
    // Check for cancellation
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
    }

    // Use context for timeouts
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()

    return s.store.Create(ctx, item)
}
```

### Concurrency

```go
// Use sync primitives appropriately
type Service struct {
    mu    sync.RWMutex
    cache map[string]Item
}

func (s *Service) Get(id string) (Item, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    item, ok := s.cache[id]
    return item, ok
}

func (s *Service) Set(id string, item Item) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.cache[id] = item
}
```

### Resource Cleanup

```go
func (s *Service) Start(ctx context.Context) error {
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        s.backgroundWorker(ctx)
    }()
    return nil
}

func (s *Service) Stop(ctx context.Context) error {
    s.cancel() // Signal workers to stop

    done := make(chan struct{})
    go func() {
        s.wg.Wait()
        close(done)
    }()

    select {
    case <-done:
        return nil
    case <-ctx.Done():
        return ctx.Err()
    }
}
```

---

## Related Documentation

- [Architecture Layers](architecture-layers.md)
- [Service Catalog](service-catalog.md)
- [API Examples](examples/services.md)
- [Operations Runbook](ops-runbook.md)
