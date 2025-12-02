# Service Sandbox and Isolation Architecture

This document describes the Android-style sandbox and isolation system that protects services from each other and from the Service Layer core.

## Overview

The Service Layer implements a multi-layered security model inspired by Android's application sandbox:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Service Layer Security Model                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Layer 1: Service Identity                         │    │
│  │  • Unique ServiceID per service (like Android UID)                  │    │
│  │  • Package-based grouping                                           │    │
│  │  • Signing key verification                                         │    │
│  │  • Security level classification                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Layer 2: Capability System                        │    │
│  │  • Declared permissions in manifest (like Android permissions)      │    │
│  │  • Runtime capability checks                                        │    │
│  │  • Deny-by-default policy                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Layer 3: Resource Isolation                       │    │
│  │  • Isolated storage per service                                     │    │
│  │  • Isolated database tables                                         │    │
│  │  • Namespace-based separation                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Layer 4: IPC Security                             │    │
│  │  • All inter-service calls through IPC Manager (like Binder)        │    │
│  │  • Caller identity verification                                     │    │
│  │  • Permission checks on every call                                  │    │
│  │  • Rate limiting                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Layer 5: Security Policy                          │    │
│  │  • SELinux-style mandatory access control                           │    │
│  │  • Policy rules for subject/object/action                           │    │
│  │  • Audit logging                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Android Security Model Mapping

| Android Concept | Service Layer Equivalent | Purpose |
|-----------------|-------------------------|---------|
| UID/GID | ServiceIdentity | Unique service identification |
| Android Permissions | Capability System | Declare and check permissions |
| SELinux | SecurityPolicy | Mandatory access control |
| App Sandbox | IsolatedStorage/Database | Resource isolation |
| Binder IPC | IPCManager | Secure inter-service communication |
| PackageManager | SandboxManager | Service lifecycle management |
| Context | SandboxContext | Access to sandboxed resources |

## Components

### 1. Service Identity (`system/sandbox/sandbox.go`)

Each service receives a unique identity:

```go
type ServiceIdentity struct {
    ServiceID      string        // Unique identifier (like Android UID)
    PackageID      string        // Parent package
    ProcessID      string        // Runtime instance ID
    SigningKeyHash string        // Verification hash
    SecurityLevel  SecurityLevel // Trust level
}
```

**Security Levels:**
- `Untrusted` - Third-party services with minimal trust
- `Normal` - Standard services with normal permissions
- `Privileged` - System services with elevated permissions
- `System` - Core engine services with full access

### 2. Capability System (`system/sandbox/sandbox.go`)

Services declare required capabilities in their manifest:

```go
// Storage capabilities
CapStorageRead   // Read from own storage
CapStorageWrite  // Write to own storage
CapStorageOther  // Access other services' storage (dangerous!)

// Database capabilities
CapDatabaseRead  // Read from own tables
CapDatabaseWrite // Write to own tables
CapDatabaseOther // Access other services' tables (dangerous!)

// Bus capabilities
CapBusPublish    // Publish events
CapBusSubscribe  // Subscribe to events
CapBusInvoke     // Invoke compute

// Service capabilities
CapServiceCall   // Call other services
CapServiceManage // Start/stop other services

// System capabilities (privileged only)
CapSystemConfig  // Modify system config
CapSystemAdmin   // Full admin access
```

### 3. Isolated Storage (`system/sandbox/storage.go`)

Each service has its own storage namespace:

```go
// Service A can only access storage:service_a/*
storage.Set(ctx, "config", data)  // Stored as service_a/config

// Service A CANNOT access storage:service_b/*
// This is enforced at the storage layer
```

**Features:**
- Namespace isolation (services can't see each other's data)
- Quota enforcement (prevent storage abuse)
- Path traversal prevention
- Audit logging

### 4. Isolated Database (`system/sandbox/storage.go`)

Each service can only access tables with its prefix:

```go
// Service "accounts" can access:
// - accounts_users
// - accounts_sessions
// - accounts_*

// Service "accounts" CANNOT access:
// - gasbank_balances
// - vrf_keys
```

**Features:**
- Table prefix enforcement
- SQL query validation
- Explicit table allowlisting
- Audit logging

### 5. IPC Manager (`system/sandbox/ipc.go`)

All inter-service communication goes through the IPC Manager:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Service A  │         │ IPC Manager │         │  Service B  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  Call(B, method, args)│                       │
       │──────────────────────>│                       │
       │                       │                       │
       │                       │ 1. Verify A's identity│
       │                       │ 2. Check A has        │
       │                       │    CapServiceCall     │
       │                       │ 3. Check B allows A   │
       │                       │ 4. Check policy       │
       │                       │ 5. Check rate limit   │
       │                       │                       │
       │                       │  HandleCall(call)     │
       │                       │──────────────────────>│
       │                       │                       │
       │                       │       result          │
       │                       │<──────────────────────│
       │                       │                       │
       │       result          │                       │
       │<──────────────────────│                       │
```

**Security Checks:**
1. Caller identity verification
2. Capability check (CapServiceCall)
3. Target's allowed callers list
4. Security policy evaluation
5. Rate limiting

### 6. Security Policy (`system/sandbox/sandbox.go`)

SELinux-style mandatory access control:

```go
// Default rules (deny-by-default)
{Subject: "*", Object: "*", Action: "*", Effect: Deny, Priority: 0}

// Allow services to access their own storage
{Subject: "${service}", Object: "storage:${service}/*", Action: "read", Effect: Allow, Priority: 100}

// System services have elevated access
{Subject: "system.*", Object: "*", Action: "*", Effect: Allow, Priority: 1000}
```

### 7. Security Auditor (`system/sandbox/sandbox.go`)

All security-relevant events are logged:

```go
type AuditEvent struct {
    Timestamp time.Time
    EventType string    // capability_check, resource_access, ipc_call
    ServiceID string
    Action    string
    Resource  string
    Allowed   bool
}
```

## Usage Example

### Creating a Sandbox for a Service

```go
manager := sandbox.NewManager(db, sandbox.DefaultManagerConfig())

// Create sandbox for a service
sb, err := manager.CreateSandbox(ctx, sandbox.CreateSandboxRequest{
    ServiceID: "com.r3e.services.accounts",
    PackageID: "com.r3e.services.accounts",
    SecurityLevel: sandbox.SecurityLevelNormal,
    RequestedCapabilities: []sandbox.Capability{
        sandbox.CapStorageRead,
        sandbox.CapStorageWrite,
        sandbox.CapDatabaseRead,
        sandbox.CapDatabaseWrite,
        sandbox.CapBusPublish,
        sandbox.CapServiceCall,
    },
    StorageQuota: 50 * 1024 * 1024, // 50MB
    AllowedTables: []string{"accounts_users", "accounts_sessions"},
})
```

### Using Sandboxed Resources

```go
// Storage access (isolated to service's namespace)
storage := sb.Storage
err := storage.Set(ctx, "config/settings", configData)
data, err := storage.Get(ctx, "config/settings")

// Database access (restricted to allowed tables)
database := sb.Database
rows, err := database.Query(ctx, "SELECT * FROM accounts_users WHERE id = $1", userID)

// IPC calls (with permission checks)
ipc := sb.IPC
result, err := ipc.Call(ctx, "com.r3e.services.secrets", "GetSecret", args)
```

## Security Guarantees

### Service A Cannot Hack Service B

1. **Storage Isolation**: Service A's storage namespace is completely separate from Service B's
2. **Database Isolation**: Service A can only access tables with its prefix
3. **IPC Security**: All calls go through IPC Manager with permission checks
4. **No Direct References**: Services cannot obtain direct references to other services' objects

### Service Cannot Hack Service Layer

1. **Capability Restrictions**: Services cannot access system capabilities without explicit grant
2. **Policy Enforcement**: Security policy denies access to system resources by default
3. **Audit Trail**: All access attempts are logged
4. **Rate Limiting**: Prevents DoS attacks against the engine

## File Locations

| Component | Path |
|-----------|------|
| Core Sandbox | `system/sandbox/sandbox.go` |
| IPC Manager | `system/sandbox/ipc.go` |
| Storage Isolation | `system/sandbox/storage.go` |
| Sandbox Manager | `system/sandbox/manager.go` |

## Integration with Existing Runtime

The sandbox system integrates with the existing `PackageRuntime`:

```go
// Existing runtime provides basic isolation
type PackageRuntime interface {
    Storage() (PackageStorage, error)  // Basic storage
    Bus() (BusClient, error)           // Basic bus access
}

// Sandbox provides enhanced isolation
type RuntimeAdapter struct {
    sandbox *ServiceSandbox
}

func (r *RuntimeAdapter) Storage() *IsolatedStorage {
    return r.sandbox.Storage  // Namespace-isolated storage
}

func (r *RuntimeAdapter) IPC() *IPCProxy {
    return r.sandbox.IPC  // Secure IPC with permission checks
}
```

## Best Practices

1. **Request Minimal Capabilities**: Only request capabilities your service actually needs
2. **Use IPC for Cross-Service Communication**: Never try to access other services directly
3. **Validate All Inputs**: Even from trusted services, validate IPC call arguments
4. **Handle Permission Denials Gracefully**: Check for `CapabilityDeniedError`
5. **Monitor Audit Logs**: Review security events for anomalies

## Related Documentation

- [Architecture Layers](architecture-layers.md)
- [Framework Guide](framework-guide.md)
- [Enclave Attestation](enclave-attestation.md)
- [Security Hardening](security-hardening.md)
