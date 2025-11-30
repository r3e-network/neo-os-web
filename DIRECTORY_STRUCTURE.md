# Service Layer - New Directory Structure

## Overview

The codebase has been reorganized to follow **Android OS + APK architecture**:

- **`system/`** = Android OS (Service Engine)
- **`packages/`** = Android APK files (Service Implementations)
- **`applications/`** = System Apps (API Servers)

## Complete Directory Structure

```
service_layer/
│
├── system/                          # 🤖 Android OS equivalent - Service Engine
│   ├── core/                        # Engine core components
│   │   ├── engine.go                # Main engine coordinator
│   │   ├── registry.go              # Service registry
│   │   ├── lifecycle.go             # Lifecycle management
│   │   ├── bus.go                   # Event/Data bus
│   │   ├── health.go                # Health monitoring
│   │   ├── dependency.go            # Dependency resolution
│   │   ├── metadata.go              # Metadata management
│   │   ├── interfaces.go            # Core interfaces
│   │   ├── apis.go                  # API surface definitions
│   │   ├── options.go               # Engine options
│   │   └── *_test.go                # Tests
│   │
│   ├── framework/                   # 🛠️ Service Framework (SDK)
│   │   ├── base.go                  # ServiceBase implementation
│   │   ├── manifest.go              # Manifest definitions
│   │   ├── bus.go                   # BusClient interface
│   │   ├── bus_impl.go              # Bus implementation
│   │   ├── errors.go                # Framework errors
│   │   ├── builder.go               # ServiceBuilder pattern
│   │   ├── lifecycle/               # Lifecycle helpers
│   │   └── testing/                 # Testing utilities
│   │
│   ├── runtime/                     # 📦 Package Runtime (PackageManager + Context)
│   │   ├── package.go               # PackageManifest, ServicePackage interfaces
│   │   ├── runtime.go               # PackageRuntime implementation
│   │   ├── loader.go                # PackageLoader implementation
│   │   └── package_test.go          # Runtime tests
│   │
│   ├── platform/                    # 🏗️ Platform Services (HAL)
���   │   ├── database/                # Database abstractions
│   │   └── migrations/              # Database migrations
│   │
│   └── apis/                        # 🔌 System API Definitions
│       └── (API contracts)
│
├── packages/                        # 📱 Service Packages (Android APK equivalent)
│   ├── com.r3e.services.accounts/
│   │   ├── manifest.yaml            # ✨ Package manifest (like AndroidManifest.xml)
│   │   ├── package.go               # Package implementation
│   │   ├── service.go               # Service business logic
│   │   ├── service_test.go          # Service tests
│   │   ├── handlers.go              # (optional) API handlers
│   │   ├── store.go                 # (optional) Storage interface
│   │   └── README.md                # Package documentation
│   │
│   ├── com.r3e.services.functions/
│   │   ├── manifest.yaml
│   │   ├── package.go
│   │   ├── service.go
│   │   ├── service_test.go
│   │   └── devpack/                 # Function runtime
│   │
│   ├── com.r3e.services.vrf/
│   ├── com.r3e.services.oracle/
│   ├── com.r3e.services.triggers/
│   ├── com.r3e.services.gasbank/
│   ├── com.r3e.services.automation/
│   ├── com.r3e.services.pricefeed/
│   ├── com.r3e.services.datafeeds/
│   ├── com.r3e.services.datastreams/
│   ├── com.r3e.services.datalink/
│   ├── com.r3e.services.dta/
│   ├── com.r3e.services.confidential/
│   ├── com.r3e.services.cre/
│   ├── com.r3e.services.ccip/
│   ├── com.r3e.services.secrets/
│   └── com.r3e.services.random/
│
├── applications/                    # 🖥️ Presentation Layer
│   ├── httpapi/                     # HTTP API server
│   ├── services.go                  # ServiceProvider contracts for transports
│   ├── grpcapi/                     # (future) gRPC API server
│   └── dashboard/                   # (future) Web UI
│
├── domain/                          # 📚 Domain Models (Shared)
│   ├── account/
│   ├── function/
│   ├── trigger/
│   ├── automation/
│   ├── oracle/
│   ├── pricefeed/
│   ├── gasbank/
│   ├── vrf/
│   └── .../
│
├── sdk/                             # 👨‍💻 SDKs for External Developers
│   ├── go/                          # Go SDK
│   ├── rust/                        # Rust SDK
│   └── typescript/                  # TypeScript SDK
│
├── cmd/                             # 🚀 Command-line Tools
│   ├── appserver/                   # Main application server
│   │   └── main.go
│   ├── neo-indexer/                 # Blockchain indexer
│   └── neo-snapshot/                # State snapshot tool
│
├── pkg/                             # 📦 Public Libraries
│   ├── storage/                     # Storage interfaces + adapters (memory/Postgres)
│   ├── logger/                      # Logging utilities
│   └── utils/                       # Common utilities
│
├── configs/                         # ⚙️ Configuration Files
│   └── *.yaml
│
├── scripts/                         # 🔧 Build and Deployment Scripts
│   ├── generate_packages.go         # Generate package.go files
│   └── generate_manifests.sh        # Generate manifest.yaml files
│
├── docs/                            # 📖 Documentation
│   ├── NEW_DIRECTORY_STRUCTURE.md   # This file
│   ├── android-style-refactoring.md # Architecture guide
│   ├── IMPLEMENTATION_COMPLETE.md   # Implementation report
│   └── service-engine-architecture.md
│
├── test/                            # 🧪 Integration Tests
│   └── integration/
│
├── internal/                        # (Legacy - to be deprecated)
│   └── (old structure preserved for transition)
│
├── go.mod
├── go.sum
├── Makefile
├── README.md
└── LICENSE
```

## Directory Purpose

### System Layer (`system/`)

| Directory | Purpose | Lines | Android Equivalent |
|-----------|---------|-------|--------------------|
| `system/core/` | Engine orchestration, registry, lifecycle | ~1500 | Android Framework (system/core) |
| `system/framework/` | Service SDK, base classes, helpers | ~800 | Android SDK (framework/base) |
| `system/runtime/` | Package loading, permissions, quotas | ~850 | PackageManager + Context |
| `system/platform/` | Infrastructure abstractions | ~500 | HAL (hardware abstraction) |
| `system/apis/` | System API contracts | - | AIDL interfaces |

### Package Layer (`packages/`)

**Format**: `com.r3e.services.<service_name>/`

Each package contains:
- `manifest.yaml` - Declarative package configuration (permissions, resources, dependencies)
- `package.go` - ServicePackage implementation (init, lifecycle hooks)
- `service.go` - Business logic
- `*_test.go` - Tests
- `README.md` - Documentation

**17 Service Packages**:
1. `com.r3e.services.accounts` - Account management
2. `com.r3e.services.functions` - Serverless functions
3. `com.r3e.services.vrf` - Verifiable random functions
4. `com.r3e.services.oracle` - Oracle data feeds
5. `com.r3e.services.triggers` - Event triggers
6. `com.r3e.services.gasbank` - Gas fee sponsorship
7. `com.r3e.services.automation` - Task automation
8. `com.r3e.services.pricefeed` - Price data
9. `com.r3e.services.datafeeds` - Data feeds
10. `com.r3e.services.datastreams` - Data streaming
11. `com.r3e.services.datalink` - Cross-chain linking
12. `com.r3e.services.dta` - Token automation
13. `com.r3e.services.confidential` - Confidential computing
14. `com.r3e.services.cre` - Contract runtime
15. `com.r3e.services.ccip` - Cross-chain protocol
16. `com.r3e.services.secrets` - Secret management
17. `com.r3e.services.random` - Random number generation

### Application Layer (`applications/`)

Presentation layer servers that expose services via APIs:
- `httpapi/` - RESTful HTTP API
- `services.go` - Shared `ServiceProvider` surface implemented by application/engine runtime
- `grpcapi/` - (future) gRPC API
- `dashboard/` - (future) Web management UI

## Key Architectural Principles

### 1. Clear Separation of Concerns

```
System (Android OS)  →  Provides APIs and infrastructure
   ↓ (controlled access)
Packages (Apps)      →  Business logic, depends on System APIs
   ↓ (expose via)
Applications         →  External interfaces (HTTP, gRPC, etc.)
```

### 2. Android-Style Isolation

- ✅ Each package has its own namespace (`com.r3e.services.*`)
- ✅ Packages access system resources via `PackageRuntime` (like Android Context)
- ✅ Permissions declared in `manifest.yaml` and enforced at runtime
- ✅ Resource quotas (storage, CPU, events) per package

### 3. Self-Contained Packages

Each package is a complete unit:
```
com.r3e.services.accounts/
├── manifest.yaml      # What I need and provide
├── package.go         # How to install/run me
├── service.go         # What I do
└── *_test.go          # How to test me
```

### 4. Declarative Configuration

`manifest.yaml` declares everything upfront:
- Services provided
- Permissions required
- Resource quotas
- Dependencies
- Metadata

No code changes needed to adjust these!

## Usage Examples

### Importing System Components

```go
// Before (old structure)
import engine "github.com/R3E-Network/service_layer/internal/engine"
import "github.com/R3E-Network/service_layer/internal/framework"

// After (new structure)
import engine "github.com/R3E-Network/service_layer/system/core"
import "github.com/R3E-Network/service_layer/system/framework"
import pkg "github.com/R3E-Network/service_layer/system/runtime"
```

### Importing Service Packages

```go
// Before
import "github.com/R3E-Network/service_layer/internal/services/accounts"

// After
import accounts "github.com/R3E-Network/service_layer/packages/com.r3e.services.accounts"

// Or with blank import for auto-registration
import _ "github.com/R3E-Network/service_layer/packages/com.r3e.services.accounts"
```

### Creating a New Service Package

1. Create directory:
```bash
mkdir -p packages/com.r3e.services.myservice
```

2. Create `manifest.yaml`:
```yaml
package_id: com.r3e.services.myservice
version: "1.0.0"
services:
  - name: myservice
    domain: myservice
permissions:
  - name: system.api.storage
    required: true
```

3. Create `package.go`:
```go
package myservice

import pkg "github.com/R3E-Network/service_layer/system/runtime"

func init() {
    pkg.MustRegisterPackage("com.r3e.services.myservice", ...)
}
```

4. Done! Package auto-registers on import.

### 5. Transition to Engine Mode

The system now supports two runtime modes:

#### Legacy Mode (default)
```bash
./appserver --dsn="postgresql://..."
```
- Direct service instantiation
- Services managed by `system.Manager`

#### Engine Mode (Android-style)
```bash
./appserver --dsn="postgresql://..." --engine-mode
```
- Services loaded via `PackageLoader`
- Engine manages lifecycle
- Package permissions and quotas enforced
- Module health visible via `/system/status`

## Migration Status

### ✅ Completed

- [x] Created new directory structure
- [x] Copied all system components to `system/`
- [x] Reorganized 17 services into `packages/`
- [x] Generated `manifest.yaml` for all packages
- [x] Preserved `internal/` for backward compatibility

### 🔄 In Progress

- [ ] Update import paths across codebase
- [ ] Move applications to `applications/`
- [ ] Consolidate domain models

### 📋 Future

- [ ] Deprecate `internal/` completely
- [ ] Add `applications/grpcapi`
- [ ] Add `applications/dashboard`
- [ ] Package signing and verification

## Benefits of New Structure

### 1. **Discoverability**
- Services at top-level `packages/` (not buried in `internal/services`)
- Clear naming: `com.r3e.services.*` like Android packages

### 2. **Modularity**
- Each package is self-contained
- Easy to extract into separate repository if needed

### 3. **Clarity**
- System vs Packages vs Applications
- Reflects the architectural model directly

### 4. **Maintainability**
- Related files grouped together
- `manifest.yaml` provides package overview

### 5. **Android Familiarity**
- Developers familiar with Android will immediately understand the structure

## Transition Strategy

### Phase 1 (Current): Dual Structure
- Both `internal/` and new structure coexist
- Old imports still work
- New code uses new structure

### Phase 2: Gradual Migration
- Update imports file by file
- Run tests after each batch
- Use `go mod tidy` to clean up

### Phase 3: Deprecation
- Mark `internal/` as deprecated
- Remove after all imports migrated

## Notes

- **Backward Compatible**: Old `internal/` structure preserved
- **Files Copied**: Not moved, to avoid breaking existing code
- **Import Paths**: Can be updated gradually
- **Testing**: All tests should still pass with either import path

---

**Last Updated**: 2025-01-28
**Status**: ✅ Directory structure created, ready for import migration
