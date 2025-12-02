# Service Layer - Directory Structure

## Overview

The codebase follows **Android OS + APK architecture** with **TEE (Trusted Execution Environment) enclave** support:

- **`system/`** = Android OS (Service Engine)
- **`packages/`** = Android APK files (Service Implementations with Enclave)
- **`applications/`** = System Apps (API Servers)

## Complete Directory Structure

```
service_layer/
│
├── system/                          # Service Engine (Android OS equivalent)
│   ├── core/                        # Engine core components
│   │   ├── engine.go                # Main engine coordinator
│   │   ├── registry.go              # Service registry
│   │   ├── lifecycle.go             # Lifecycle management
│   │   ├── bus.go                   # Event/Data bus
│   │   ├── health.go                # Health monitoring
│   │   ├── dependency.go            # Dependency resolution
│   │   ├── metadata.go              # Metadata management
│   │   ├── interfaces.go            # Core interfaces
│   │   ├── api.go                   # API surface definitions
│   │   ├── api_router.go            # API routing
│   │   ├── service_router.go        # Service routing
│   │   └── *_test.go                # Tests
│   │
│   ├── framework/                   # Service Framework (SDK)
│   │   ├── core/                    # Core framework components
│   │   │   ├── base.go              # ServiceBase implementation
│   │   │   ├── api.go               # API definitions
│   │   │   ├── api_router.go        # API routing
│   │   │   └── service_router.go    # Service routing
│   │   ├── manifest.go              # Manifest definitions
│   │   ├── bus.go                   # BusClient interface
│   │   ├── bus_impl.go              # Bus implementation
│   │   ├── errors.go                # Framework errors
│   │   ├── builder.go               # ServiceBuilder pattern
│   │   ├── lifecycle/               # Lifecycle helpers
│   │   └── testing/                 # Testing utilities
│   │
│   ├── runtime/                     # Package Runtime (PackageManager + Context)
│   │   ├── package.go               # PackageManifest, ServicePackage interfaces
│   │   ├── runtime.go               # PackageRuntime implementation
│   │   ├── loader.go                # PackageLoader implementation
│   │   └── package_test.go          # Runtime tests
│   │
│   └── platform/                    # Platform Services (HAL)
│       ├── database/                # Database abstractions
│       └── migrations/              # Database migrations
│
├── packages/                        # Service Packages (Android APK equivalent)
│   ├── README.md                    # Package architecture documentation
│   │
│   ├── com.r3e.services.accounts/   # Account management service
│   │   ├── manifest.yaml            # Package manifest
│   │   ├── README.md                # Service documentation
│   │   ├── contract/                # Smart contracts (Neo N3)
│   │   │   ├── *.cs                 # Contract source
│   │   │   ├── *.nef                # Compiled contract
│   │   │   └── *.manifest.json      # Contract manifest
│   │   ├── enclave/                 # TEE enclave code
│   │   │   └── enclave.go           # Account key derivation, message signing
│   │   └── service/                 # Go service implementation
│   │       ├── domain.go            # Type definitions
│   │       ├── store.go             # Store interface
│   │       ├── store_postgres.go    # PostgreSQL implementation
│   │       ├── service.go           # Business logic
│   │       ├── package.go           # Service registration
│   │       └── *_test.go            # Tests
│   │
│   ├── com.r3e.services.automation/ # Task automation service
│   ├── com.r3e.services.ccip/       # Cross-chain interoperability
│   ├── com.r3e.services.confidential/ # Confidential computing
│   ├── com.r3e.services.cre/        # Chainlink Runtime Environment
│   ├── com.r3e.services.datafeeds/  # Price data feeds
│   ├── com.r3e.services.datalink/   # External data linking
│   ├── com.r3e.services.datastreams/ # Data streaming
│   ├── com.r3e.services.dta/        # Data Trust Authority
│   ├── com.r3e.services.functions/  # Serverless functions (CRE)
│   ├── com.r3e.services.gasbank/    # Gas fee sponsorship
│   ├── com.r3e.services.mixer/      # Privacy mixer service
│   ├── com.r3e.services.oracle/     # Oracle data feeds
│   ├── com.r3e.services.secrets/    # Secret management
│   └── com.r3e.services.vrf/        # Verifiable random functions
│
├── applications/                    # Presentation Layer
│   ├── application.go               # Application interface
│   ├── engine_app.go                # Engine application
│   ├── services.go                  # ServiceProvider contracts
│   ├── httpapi/                     # HTTP API server
│   │   ├── handler.go               # Main handler
│   │   ├── middleware.go            # Middleware
│   │   └── routes.go                # Route definitions
│   ├── grpcapi/                     # (future) gRPC API server
│   └── dashboard/                   # (future) Web UI
│
├── sdk/                             # SDKs for External Developers
│   ├── go/                          # Go SDK
│   ├── rust/                        # Rust SDK
│   └── typescript/                  # TypeScript SDK
│
├── cmd/                             # Command-line Tools
│   ├── appserver/                   # Main application server
│   │   └── main.go
│   ├── neo-indexer/                 # Blockchain indexer
│   └── neo-snapshot/                # State snapshot tool
│
├── pkg/                             # Public Libraries
│   ├── storage/                     # Storage interfaces + adapters
│   │   ├── crud.go                  # CRUD operations
│   │   ├── interfaces_admin.go      # Admin interfaces
│   │   └── postgres/                # PostgreSQL implementation
│   ├── logger/                      # Logging utilities
│   └── utils/                       # Common utilities
│
├── frontend/                        # Web Frontend
│   └── (React/Vue/etc. application)
│
├── contracts/                       # Shared Smart Contracts
│   └── neo-n3/                      # Neo N3 contracts
│
├── configs/                         # Configuration Files
│   └── *.yaml
│
├── scripts/                         # Build and Deployment Scripts
│   ├── generate_packages.go         # Generate package.go files
│   ├── generate_manifests.sh        # Generate manifest.yaml files
│   └── detect_similar_dirs.sh       # Detect duplicate directories
│
├── docs/                            # Documentation
│   ├── architecture/                # Architecture docs
│   └── api/                         # API documentation
│
├── test/                            # Integration Tests
│   └── integration/
│
├── tools/                           # Development Tools
│
├── devops/                          # DevOps Configuration
│   ├── docker/                      # Docker files
│   └── k8s/                         # Kubernetes manifests
│
├── go.mod
├── go.sum
├── Makefile
├── README.md
└── LICENSE
```

## Service Package Structure

Each service package follows a standardized structure with **service** and **enclave** separation:

```
packages/com.r3e.services.<name>/
├── manifest.yaml       # Service manifest and configuration
├── README.md           # Service documentation
├── contract/           # Smart contracts (if applicable)
│   ├── *.cs            # Neo N3 contract source
│   ├── *.nef           # Compiled contract
│   └── *.manifest.json # Contract manifest
├── enclave/            # TEE enclave code (confidential computing)
│   └── enclave.go      # Core cryptographic operations
└── service/            # Go service implementation
    ├── domain.go       # Type definitions (models, enums, constants)
    ├── store.go        # Store interface and dependency interfaces
    ├── store_postgres.go # PostgreSQL implementation
    ├── service.go      # Core business logic
    ├── service_test.go # Unit tests
    ├── package.go      # Service registration and initialization
    └── testing.go      # Test helpers and mocks
```

## Enclave Architecture

Each service has an `enclave/` directory containing TEE-protected operations:

| Service | Enclave Core Functions |
|---------|------------------------|
| **accounts** | Account key derivation, message signing |
| **automation** | Job execution signing, execution verification |
| **ccip** | Cross-chain message validation/signing |
| **confidential** | Confidential data encryption/decryption |
| **cre** | Function execution, result signing, execution proofs |
| **datafeeds** | Price aggregation, data signing |
| **datalink** | External data fetch/signing |
| **datastreams** | Stream data validation/signing |
| **dta** | Data integrity attestation |
| **functions** | Function execution within TEE |
| **gasbank** | Balance calculations, fee deductions, settlement signing |
| **mixer** | HD key derivation, transaction signing, mixing pool encryption |
| **oracle** | Data validation/signing, multi-source aggregation |
| **secrets** | Secret encryption/decryption, key derivation, secure storage |
| **vrf** | VRF key generation, verifiable randomness, proof verification |

### Enclave Design Principles

1. **Confidentiality**: All sensitive operations (key management, signing, encryption) execute inside TEE
2. **Integrity**: Every operation generates verifiable signatures/proofs
3. **Remote Attestation**: Each enclave supports `GenerateAttestationReport()` for TEE verification
4. **Isolation**: `service/` handles business logic, `enclave/` handles security-sensitive operations

## Service List (14 Services)

| # | Service | Description | Contract | Enclave |
|---|---------|-------------|----------|---------|
| 1 | `accounts` | Account management | ✅ | ✅ |
| 2 | `automation` | Task automation (Chainlink Automation) | ✅ | ✅ |
| 3 | `ccip` | Cross-chain interoperability protocol | - | ✅ |
| 4 | `confidential` | Confidential computing | - | ✅ |
| 5 | `cre` | Chainlink Runtime Environment | ✅ | ✅ |
| 6 | `datafeeds` | Price data feeds | ✅ | ✅ |
| 7 | `datalink` | External data linking | - | ✅ |
| 8 | `datastreams` | Data streaming | - | ✅ |
| 9 | `dta` | Data Trust Authority | - | ✅ |
| 10 | `gasbank` | Gas fee sponsorship | ✅ | ✅ |
| 11 | `mixer` | Privacy mixer service | - | ✅ |
| 12 | `oracle` | Oracle data feeds | ✅ | ✅ |
| 13 | `secrets` | Secret management | ✅ | ✅ |
| 14 | `vrf` | Verifiable random functions | ✅ | ✅ |

## Key Architectural Principles

### 1. Clear Separation of Concerns

```
System (Android OS)  →  Provides APIs and infrastructure
   ↓ (controlled access)
Packages (Apps)      →  Business logic + Enclave (TEE)
   ↓ (expose via)
Applications         →  External interfaces (HTTP, gRPC, etc.)
```

### 2. Service/Enclave Isolation

- **Service Layer** (`service/`): Business logic, API handlers, storage
- **Enclave Layer** (`enclave/`): Cryptographic operations, key management, signing

### 3. Self-Contained Packages

Each package is a complete unit:
```
com.r3e.services.xxx/
├── manifest.yaml      # What I need and provide
├── contract/          # My smart contracts
├── enclave/           # My TEE-protected operations
└── service/           # My business logic
```

### 4. Self-Registration Pattern

Services register themselves via `init()` functions:

```go
// service/package.go
func init() {
    pkg.MustRegisterPackage("com.r3e.services.myservice", func() (pkg.ServicePackage, error) {
        return &Package{...}, nil
    })
}
```

## Import Paths

```go
// Service code
import "github.com/R3E-Network/service_layer/packages/com.r3e.services.xxx/service"

// Enclave code
import "github.com/R3E-Network/service_layer/packages/com.r3e.services.xxx/enclave"

// System framework
import "github.com/R3E-Network/service_layer/system/framework"
import pkg "github.com/R3E-Network/service_layer/system/runtime"
```

## Runtime Modes

### Legacy Mode (default)
```bash
./appserver --dsn="postgresql://..."
```
- Direct service instantiation
- Services managed by `system.Manager`

### Engine Mode (Android-style)
```bash
./appserver --dsn="postgresql://..." --engine-mode
```
- Services loaded via `PackageLoader`
- Engine manages lifecycle
- Package permissions and quotas enforced
- Module health visible via `/system/status`

---

**Last Updated**: 2025-12-02
**Status**: ✅ All services have service/ and enclave/ directories
