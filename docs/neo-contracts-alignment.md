# NEO N3 Smart Contracts ↔ Service Layer Alignment

This document defines the mapping between NEO N3 smart contracts and the Go service layer, ensuring consistency and completeness.

## Contract Overview

| Contract | Location | Go Service | Alignment |
|----------|----------|------------|-----------|
| Manager.cs | contracts/neo-n3/ | (system/auth) | Partial |
| ServiceRegistry.cs | contracts/neo-n3/ | framework.Manifest | Partial |
| AccountManager.cs | contracts/neo-n3/ | services/accounts | Partial |
| SecretsVault.cs | contracts/neo-n3/ | services/secrets | Partial |
| AutomationScheduler.cs | contracts/neo-n3/ | services/automation | Good |
| OracleHub.cs | contracts/neo-n3/ | services/oracle | Good |
| RandomnessHub.cs | contracts/neo-n3/ | services/vrf | Good |
| DataFeedHub.cs | contracts/neo-n3/ | services/datafeeds | Good |
| JAMInbox.cs | contracts/neo-n3/ | app/jam | Partial |

## Architecture Mapping

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NEO N3 Blockchain Layer                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Manager ─────► ServiceRegistry ─────► AccountManager            │  │
│  │     │                                       │                     │  │
│  │     ▼                                       ▼                     │  │
│  │  OracleHub    RandomnessHub    DataFeedHub    SecretsVault       │  │
│  │     │              │                │             │               │  │
│  │     ▼              ▼                ▼             ▼               │  │
│  │  AutomationScheduler ─────────────► JAMInbox                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                        Service Layer (Go)                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  system/manager ── framework/manifest ── services/accounts       │  │
│  │        │                                       │                  │  │
│  │        ▼                                       ▼                  │  │
│  │  services/oracle  services/vrf  services/datafeeds  services/secrets │
│  │        │              │                │             │            │  │
│  │        ▼              ▼                ▼             ▼            │  │
│  │  services/automation ────────────────► app/jam                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Mappings

### 1. Manager.cs ↔ System/Auth

**Contract Roles (bit flags):**
```csharp
RoleAdmin           = 0x01
RoleScheduler       = 0x02
RoleOracleRunner    = 0x04
RoleRandomnessRunner = 0x08
RoleJamRunner       = 0x10
RoleDataFeedSigner  = 0x20
```

**Go Equivalent:**
- Role checking: `applications/httpapi/auth.go`
- API tokens: `API_TOKENS` environment variable
- JWT auth: `AUTH_USERS`, `AUTH_JWT_SECRET`
- Tenant isolation: `X-Tenant-ID` header

**Mapping:**
| Contract Role | Go Implementation |
|--------------|-------------------|
| RoleAdmin | Admin JWT token with `admin` role |
| RoleScheduler | Service account with automation access |
| RoleOracleRunner | `ORACLE_RUNNER_TOKENS` config |
| RoleRandomnessRunner | Service account |
| RoleJamRunner | `JAM_ALLOWED_TOKENS` config |
| RoleDataFeedSigner | Signer set in datafeed config |

---

### 2. ServiceRegistry.cs ↔ framework.Manifest

**Contract Structure:**
```csharp
struct Service {
    ByteString Id;
    UInt160 Owner;
    byte Version;
    ByteString CodeHash;
    ByteString ConfigHash;
    byte Capabilities;
    bool Paused;
}
```

**Go Manifest:**
```go
type Manifest struct {
    Name         string
    Domain       string
    Description  string
    Version      string              // Added for alignment
    Layer        string
    Capabilities []string
    DependsOn    []string
    RequiresAPIs []APISurface
    Quotas       map[string]string
    Tags         map[string]string
    Enabled      *bool               // Maps to Paused
}
```

**Field Mapping:**
| Contract | Go | Notes |
|----------|----|----|
| Id | Name | Direct mapping |
| Owner | (not tracked) | Services are system-owned |
| Version | Version | Added in framework |
| CodeHash | (not tracked) | Could add for verification |
| ConfigHash | (not tracked) | Could add for verification |
| Capabilities | Capabilities | byte → []string |
| Paused | Enabled | Inverted boolean |

---

### 3. AccountManager.cs ↔ services/accounts

**Contract:**
```csharp
struct Account {
    ByteString Id;
    UInt160 Owner;
    ByteString MetadataHash;
}

struct Wallet {
    ByteString AccountId;
    UInt160 Address;
    byte Status;  // 0=active, 1=revoked
}
```

**Go Domain:**
```go
// domain/account/model.go
type Account struct {
    ID        string
    Owner     string
    Metadata  map[string]string
    CreatedAt time.Time
    UpdatedAt time.Time
}

// Wallet: handled by gasbank service (WorkspaceWallet)
```

**Mapping:**
| Contract | Go | Status |
|----------|----|----|
| Account.Id | Account.ID | ✓ Aligned |
| Account.Owner | Account.Owner | Type differs (UInt160 vs string) |
| Account.MetadataHash | Account.Metadata | Hash vs full map |
| Wallet.AccountId | WorkspaceWallet.AccountID | ✓ In gasbank |
| Wallet.Address | WorkspaceWallet.Address | ✓ In gasbank |
| Wallet.Status | WorkspaceWallet.Status | Needs addition |

---

### 4. SecretsVault.cs ↔ services/secrets

**Contract:**
```csharp
struct Secret {
    ByteString Id;
    UInt160 Owner;
    ByteString RefHash;  // off-chain reference
    byte ACL;            // access control flags
}
```

**Go Domain:**
```go
// domain/secret/model.go
type Secret struct {
    ID        string
    AccountID string
    Name      string
    Value     string  // encrypted, stored in DB
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

**Key Differences:**
1. **Storage Model**: Contract stores hash reference; Go stores encrypted value
2. **ACL**: Contract has byte flags; Go relies on account ownership only
3. **Owner**: Contract uses blockchain address; Go uses account ID

**Recommended ACL Flags (for future alignment):**
```go
const (
    ACLOracleAccess     = 0x01
    ACLAutomationAccess = 0x02
    ACLFunctionAccess   = 0x04
    ACLJAMAccess        = 0x08
)
```

---

### 5. AutomationScheduler.cs ↔ services/automation

**Contract:**
```csharp
struct Job {
    ByteString Id;
    ByteString ServiceId;
    string Spec;
    ByteString PayloadHash;
    int MaxRuns;
    int Runs;
    BigInteger NextRun;
    byte Status;  // 0=active, 1=completed, 2=paused
}
```

**Go Domain:**
```go
// domain/automation/model.go
type Job struct {
    ID          string
    AccountID   string
    FunctionID  string
    Name        string
    Schedule    string
    Enabled     bool
    LastRun     time.Time
    NextRun     time.Time
    RunCount    int       // Maps to Runs
    MaxRuns     int       // Needs addition
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

**Status Mapping:**
| Contract | Go |
|----------|---|
| 0 (active) | Enabled=true |
| 1 (completed) | Enabled=false, MaxRuns reached |
| 2 (paused) | Enabled=false |

---

### 6. OracleHub.cs ↔ services/oracle

**Contract:**
```csharp
struct Request {
    ByteString Id;
    ByteString ServiceId;
    ByteString PayloadHash;
    long Fee;
    byte Status;  // 0=pending, 1=fulfilled, 2=failed
    BigInteger RequestedAt;
    BigInteger FulfilledAt;
    ByteString ResultHash;
}
```

**Go Domain:**
```go
// domain/oracle/model.go
type Request struct {
    ID           string
    AccountID    string
    DataSourceID string
    Status       RequestStatus
    Attempts     int
    Payload      string
    Result       string
    Error        string
    CreatedAt    time.Time
    UpdatedAt    time.Time
    CompletedAt  time.Time
}

type RequestStatus string
const (
    StatusPending   RequestStatus = "pending"
    StatusRunning   RequestStatus = "running"
    StatusSucceeded RequestStatus = "succeeded"
    StatusFailed    RequestStatus = "failed"
)
```

**Status Mapping:**
| Contract | Go | Notes |
|----------|---|---|
| 0 (pending) | pending | ✓ |
| - | running | Go-only intermediate state |
| 1 (fulfilled) | succeeded | ✓ |
| 2 (failed) | failed | ✓ |

---

### 7. RandomnessHub.cs ↔ services/vrf

**Contract:**
```csharp
struct Request {
    ByteString Id;
    ByteString ServiceId;
    ByteString SeedHash;
    byte Status;
    ByteString Output;
    BigInteger RequestedAt;
    BigInteger FulfilledAt;
}
```

**Go Domain:**
```go
// domain/vrf/vrf.go
type Key struct {
    ID            string
    AccountID     string
    PublicKey     string
    Label         string
    Status        KeyStatus
    WalletAddress string
    Attestation   string
    Metadata      map[string]string
}

type Request struct {
    ID        string
    AccountID string
    KeyID     string
    Consumer  string
    Seed      string
    Status    RequestStatus
    Result    string
    Error     string
    Metadata  map[string]string
}
```

**Mapping:**
| Contract | Go | Notes |
|----------|---|---|
| Id | ID | ✓ |
| ServiceId | KeyID | Maps to VRF key, not service |
| SeedHash | Seed | ✓ |
| Status | Status | ✓ |
| Output | Result | ✓ |

---

### 8. DataFeedHub.cs ↔ services/datafeeds

**Contract:**
```csharp
struct Feed {
    ByteString Id;
    ByteString Pair;
    UInt160[] Signers;
    int Threshold;
}

struct Round {
    ByteString RoundId;
    ByteString Price;
    ByteString Signer;
    BigInteger Timestamp;
}
```

**Go Domain:**
```go
// domain/datafeeds/datafeeds.go
type Feed struct {
    ID           string
    AccountID    string
    Pair         string
    SignerSet    []string
    Threshold    int          // Needs explicit field
    Aggregation  string
    Decimals     int
    Heartbeat    time.Duration
}

type Update struct {
    ID        string
    AccountID string
    FeedID    string
    RoundID   int64
    Price     string
    Signer    string
    Timestamp time.Time
    Signature string
    Status    UpdateStatus
}
```

---

### 9. JAMInbox.cs ↔ app/jam

**Contract:**
```csharp
struct Receipt {
    ByteString Hash;
    ByteString ServiceId;
    byte EntryType;
    BigInteger Seq;
    ByteString PrevRoot;
    ByteString NewRoot;
    byte Status;
    BigInteger ProcessedAt;
}
```

**Go Domain:**
```go
// applications/jam/model.go
type Receipt struct {
    Hash        string
    ServiceID   string
    EntryType   string
    Seq         int64
    PrevRoot    string
    NewRoot     string
    Status      string
    ProcessedAt time.Time
}
```

---

## Services Without Contracts

These Go services operate off-chain and don't require on-chain contracts:

| Service | Purpose | Why No Contract |
|---------|---------|-----------------|
| functions | Function execution runtime | Executes off-chain code |
| triggers | Event-based automation | Listens to events, no state |
| gasbank | Service-owned gas accounts | Uses native NEO GAS |
| datalink | Cross-chain data linking | Off-chain coordination |
| datastreams | Data stream aggregation | Real-time, no persistence |
| cre | Contract request execution | Off-chain orchestration |
| ccip | Chainlink CCIP bridge | External protocol |
| dta | Data transmission agreement | Off-chain agreements |
| confidential | Confidential computing | TEE-based, off-chain |
| pricefeed | Price aggregation | Uses DataFeedHub |

---

## Event Mapping

### Contract Events → Go Bus Events

| Contract | Contract Event | Go Event Topic |
|----------|---------------|----------------|
| Manager | ModuleUpgraded | system.module.upgraded |
| Manager | RoleGranted | system.role.granted |
| Manager | Paused | system.module.paused |
| ServiceRegistry | ServiceRegistered | service.registered |
| AccountManager | AccountCreated | account.created |
| AccountManager | WalletLinked | account.wallet.linked |
| SecretsVault | SecretStored | secret.stored |
| SecretsVault | SecretAccessed | secret.accessed |
| AutomationScheduler | JobCreated | automation.job.created |
| AutomationScheduler | JobDue | automation.job.due |
| AutomationScheduler | JobCompleted | automation.job.completed |
| OracleHub | OracleRequested | oracle.requested |
| OracleHub | OracleFulfilled | oracle.fulfilled |
| RandomnessHub | RandomnessRequested | vrf.requested |
| RandomnessHub | RandomnessFulfilled | vrf.fulfilled |
| DataFeedHub | FeedDefined | datafeed.defined |
| DataFeedHub | FeedUpdated | datafeed.updated |
| JAMInbox | ReceiptAppended | jam.receipt.appended |

---

## Type Mappings

### Blockchain ↔ Go Types

| NEO N3 Type | Go Type | Notes |
|-------------|---------|-------|
| ByteString | string | Hex-encoded |
| UInt160 | string | Neo address format |
| BigInteger | int64 or *big.Int | Depends on range |
| byte | uint8 or int | |
| bool | bool | |
| string | string | |

### Status Codes

**Unified Status Mapping:**
```go
const (
    StatusPending   = 0
    StatusFulfilled = 1  // or "succeeded"
    StatusFailed    = 2
    StatusRunning   = 3  // Go-only
    StatusPaused    = 4  // Go-only
)
```

---

## Deployment Checklist

### Contract Deployment Order

1. **Manager** (first - central registry)
2. **ServiceRegistry** (depends on Manager)
3. **AccountManager** (depends on Manager)
4. **SecretsVault** (depends on Manager)
5. **AutomationScheduler** (depends on Manager)
6. **OracleHub** (depends on Manager)
7. **RandomnessHub** (depends on Manager)
8. **DataFeedHub** (depends on Manager)
9. **JAMInbox** (depends on Manager)

### Post-Deployment

```bash
# Register modules in Manager
neo-cli invoke Manager SetModule "ServiceRegistry" <hash>
neo-cli invoke Manager SetModule "AccountManager" <hash>
neo-cli invoke Manager SetModule "SecretsVault" <hash>
neo-cli invoke Manager SetModule "AutomationScheduler" <hash>
neo-cli invoke Manager SetModule "OracleHub" <hash>
neo-cli invoke Manager SetModule "RandomnessHub" <hash>
neo-cli invoke Manager SetModule "DataFeedHub" <hash>
neo-cli invoke Manager SetModule "JAMInbox" <hash>

# Grant runner roles
neo-cli invoke Manager GrantRole <scheduler_addr> 0x02
neo-cli invoke Manager GrantRole <oracle_runner_addr> 0x04
neo-cli invoke Manager GrantRole <vrf_runner_addr> 0x08
neo-cli invoke Manager GrantRole <jam_runner_addr> 0x10
neo-cli invoke Manager GrantRole <signer_addr> 0x20
```

---

## Alignment Work Status

### Completed ✓

1. **~~Add MaxRuns to Automation Job~~** ✓
   - Added `MaxRuns int` and `RunCount int` fields to automation job model
   - Added `JobStatus` type with Active/Completed/Paused states
   - Added `IsCompleted()` helper method
   - File: `domain/automation/model.go`

2. **~~Add ACL to Secrets~~** ✓
   - Added `ACL byte` field to secret model
   - Added ACL constants (Oracle, Automation, Function, JAM access)
   - Added `HasAccess()` helper method
   - File: `domain/secret/model.go`

3. **~~Add Fee Tracking to Oracle~~** ✓
   - Added `Fee int64` field to oracle request
   - File: `domain/oracle/model.go`

4. **~~Add Wallet Status Tracking~~** ✓
   - Added `AccountStatus` type with Active/Revoked states
   - Added `Status` field to gasbank Account
   - File: `domain/gasbank/model.go`

5. **~~Add Threshold to DataFeeds~~** ✓
   - Added `Threshold int` field for multi-sig requirements
   - File: `domain/datafeeds/datafeeds.go`

6. **~~Add FulfilledAt to VRF Request~~** ✓
   - Added `FulfilledAt time.Time` field for completion timestamp
   - File: `domain/vrf/vrf.go`

7. **~~Implement ACL Enforcement~~** ✓
   - Added `CallerService` type for service identification
   - Added `ResolveSecretsWithACL()` method for ACL-enforced access
   - Added `CreateWithOptions()` and `UpdateWithOptions()` for ACL management
   - File: `packages/com.r3e.services.secrets/service.go`

8. **~~Version in Manifest~~** ✓
   - `Version string` field already exists in framework.Manifest
   - File: `system/framework/manifest.go:18`

9. **~~Implement Fee Collection~~** ✓
   - Added `FeeCollector` interface for fee management
   - Added `WithFeeCollector()` and `WithDefaultFee()` options
   - Added `CreateRequestWithOptions()` with fee tracking
   - Added `FailRequestWithOptions()` with optional fee refund
   - File: `packages/com.r3e.services.oracle/service.go`

10. **~~Add HTTP API for ACL Management~~** ✓
    - Enhanced POST /accounts/{id}/secrets with `acl` field
    - Enhanced PUT /accounts/{id}/secrets/{name} with `acl` field
    - ACL returned in secret metadata responses
    - File: `applications/httpapi/handler_functions.go`

11. **~~Implement GasBank Fee Collector Adapter~~** ✓
    - Created `FeeCollector` struct implementing `oracle.FeeCollector`
    - `CollectFee()` deducts from gas account available balance
    - `RefundFee()` returns fee on service failure
    - `SettleFee()` finalizes fee after successful completion
    - File: `packages/com.r3e.services.gasbank/fee_collector.go`

12. **~~Add CodeHash/ConfigHash to Manifest~~** ✓
    - Added `CodeHash string` for service code verification
    - Added `ConfigHash string` for config verification
    - Added `SetCodeHash()`, `SetConfigHash()` setters
    - Added `VerifyCodeHash()`, `VerifyConfigHash()` validators
    - Updated `Normalize()`, `Merge()`, `Clone()` methods
    - File: `system/framework/manifest.go`

13. **~~Content-Addressed Storage~~** ✓
    - Added `ContentDriver` interface for content-addressed storage
    - Supports Store, Retrieve, Exists, Delete, StoreWithMetadata, GetMetadata
    - Added `ContentMetadata` struct with hash, size, content type, labels, ref count
    - Added `ContentRef` type for domain model references
    - Added `ErrContentNotFound` error type
    - Added `NoopContentDriver` for testing
    - Added `MemoryContentDriver` for development/testing with:
      - SHA256-based content hashing
      - Automatic deduplication
      - Reference counting
      - Metadata support
      - Full test coverage
    - File: `system/platform/driver.go` (interface)
    - File: `system/platform/noop.go` (noop impl)
    - File: `system/platform/content_memory.go` (memory impl)
    - File: `system/platform/content_memory_test.go` (tests)

### Remaining Work

All alignment work completed! ✓

---

*Document Version: 1.5*
*Last Updated: 2025-11-25*
