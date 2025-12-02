# Service Packages Architecture

Each service package is **self-contained** and follows the principle:
> "Service engine should be generic and unaware of any specific service"

## Package Structure

Every service package follows a standardized structure with **service** and **enclave** separation:

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
| **secrets** | Secret encryption/decryption, key derivation, secure storage |
| **vrf** | VRF key generation, verifiable randomness, proof verification |
| **mixer** | HD key derivation, transaction signing, mixing pool encryption |
| **cre** | Function execution, result signing, execution proofs |
| **gasbank** | Balance calculations, fee deductions, settlement signing |
| **oracle** | Data validation/signing, multi-source aggregation |
| **automation** | Job execution signing, execution verification |
| **accounts** | Account key derivation, message signing |
| **datafeeds** | Price aggregation, data signing |
| **datastreams** | Stream data validation/signing |
| **dta** | Data integrity attestation |
| **ccip** | Cross-chain message validation/signing |
| **datalink** | External data fetch/signing |
| **confidential** | Confidential data encryption/decryption |

### Enclave Design Principles

1. **Confidentiality**: All sensitive operations (key management, signing, encryption) execute inside TEE
2. **Integrity**: Every operation generates verifiable signatures/proofs
3. **Remote Attestation**: Each enclave supports `GenerateAttestationReport()` for TEE verification
4. **Isolation**: `service/` handles business logic, `enclave/` handles security-sensitive operations

## Self-Registration Pattern

Services register themselves via `init()` functions:

```go
// package.go
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
```

## Key Principles

1. **No service-specific code in engine layer** - Engine is generic
2. **Services own their HTTP handlers** - Not in applications/httpapi/
3. **Services own their documentation** - README.md in each package
4. **Services own their contracts** - contract/ directory
5. **Services own their enclave code** - enclave/ directory
6. **Services self-register** - Via init() functions
7. **Services declare dependencies** - Via interfaces, not concrete types

## Service Status

| Service | Service | Enclave | Contract | Documentation |
|---------|---------|---------|----------|---------------|
| accounts | ✅ | ✅ | ✅ | ✅ |
| automation | ✅ | ✅ | ✅ | ✅ |
| ccip | ✅ | ✅ | - | ✅ |
| confidential | ✅ | ✅ | - | ✅ |
| cre | ✅ | ✅ | ✅ | ✅ |
| datafeeds | ✅ | ✅ | ✅ | ✅ |
| datalink | ✅ | ✅ | - | ✅ |
| datastreams | ✅ | ✅ | - | ✅ |
| dta | ✅ | ✅ | - | ✅ |
| gasbank | ✅ | ✅ | ✅ | ✅ |
| mixer | ✅ | ✅ | - | ✅ |
| oracle | ✅ | ✅ | ✅ | ✅ |
| secrets | ✅ | ✅ | ✅ | ✅ |
| vrf | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ Complete | ⏳ Partial | - Not Applicable
