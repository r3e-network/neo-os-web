# Service Layer Sandbox Integration Refactoring Plan

## Overview

This document outlines the plan to integrate the new Android-style sandbox system (`system/sandbox/`) with the existing runtime (`system/runtime/`) to provide complete service isolation.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Current Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PackageLoader ──> PackageRuntime ──> Services                  │
│       │                  │                                       │
│       │                  ├── Storage (basic isolation)          │
│       │                  ├── Bus (no caller verification)       │
│       │                  ├── StoreProvider (shared access)      │
│       │                  └── Quota (rate limiting only)         │
│       │                                                          │
│       └── Permissions (manifest-based, auto-granted)            │
│                                                                  │
│  Issues:                                                         │
│  - Services can potentially access each other's resources       │
│  - No IPC security for inter-service calls                      │
│  - No mandatory access control (MAC)                            │
│  - No audit logging                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Target Architecture                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PackageLoader ──> SandboxManager ──> ServiceSandbox            │
│       │                  │                  │                    │
│       │                  │                  ├── IsolatedStorage  │
│       │                  │                  ├── IsolatedDatabase │
│       │                  │                  ├── IPCProxy         │
│       │                  │                  └── SandboxContext   │
│       │                  │                                       │
│       │                  ├── SecurityPolicy (MAC)               │
│       │                  ├── SecurityAuditor                    │
│       │                  └── IPCManager                         │
│       │                                                          │
│       └── Capability evaluation (policy-based)                  │
│                                                                  │
│  Benefits:                                                       │
│  - Complete service isolation                                    │
│  - Secure IPC with caller verification                          │
│  - Mandatory access control                                      │
│  - Full audit trail                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Refactoring Tasks

### Phase 1: Core Integration (Priority: High)

#### 1.1 Create Sandbox-Aware Runtime
- [ ] Create `system/runtime/sandbox_runtime.go`
- [ ] Implement `SandboxedPackageRuntime` that wraps `ServiceSandbox`
- [ ] Maintain backward compatibility with existing `PackageRuntime` interface

#### 1.2 Update Package Loader
- [ ] Modify `system/runtime/loader.go` to use `SandboxManager`
- [ ] Create sandbox for each installed package
- [ ] Map manifest permissions to capabilities

#### 1.3 Integrate IPC with Bus
- [ ] Create `system/sandbox/bus_integration.go`
- [ ] Wrap existing Bus with IPC security layer
- [ ] Add caller identity to all bus messages

### Phase 2: Service Migration (Priority: Medium)

#### 2.1 Update Service Base
- [ ] Modify `system/framework/core/service.go` to support sandbox context
- [ ] Add `SandboxAware` interface for services

#### 2.2 Migrate Core Services
- [ ] Update `com.r3e.services.accounts`
- [ ] Update `com.r3e.services.secrets`
- [ ] Update `com.r3e.services.functions`
- [ ] Update remaining services

### Phase 3: Security Hardening (Priority: Medium)

#### 3.1 Policy Configuration
- [ ] Create default security policies
- [ ] Add policy configuration file support
- [ ] Implement policy hot-reload

#### 3.2 Audit Integration
- [ ] Connect auditor to existing logging
- [ ] Add audit API endpoints
- [ ] Create audit dashboard

### Phase 4: Testing & Documentation (Priority: High)

#### 4.1 Testing
- [ ] Unit tests for sandbox components
- [ ] Integration tests for IPC
- [ ] Security penetration tests

#### 4.2 Documentation
- [ ] Update architecture docs
- [ ] Create migration guide
- [ ] Update service development guide

## Implementation Details

### Key Files to Modify

| File | Changes |
|------|---------|
| `system/runtime/loader.go` | Add SandboxManager integration |
| `system/runtime/runtime.go` | Add SandboxedPackageRuntime |
| `system/runtime/package.go` | Add SandboxAware interface |
| `system/framework/core/service.go` | Add sandbox context support |
| `applications/engine_app.go` | Initialize SandboxManager |

### New Files to Create

| File | Purpose |
|------|---------|
| `system/runtime/sandbox_runtime.go` | Sandboxed runtime implementation |
| `system/sandbox/bus_integration.go` | Bus-IPC integration |
| `system/sandbox/policy_loader.go` | Policy configuration loader |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing services | High | Maintain backward compatibility |
| Performance overhead | Medium | Lazy initialization, caching |
| Complex migration | Medium | Phased rollout, feature flags |

## Testing Strategy

1. **Unit Tests**: Test each sandbox component in isolation
2. **Integration Tests**: Test service-to-service communication
3. **Security Tests**: Attempt to bypass isolation
4. **Performance Tests**: Measure overhead

## Timeline

- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 2-3 days
- Phase 4: 2-3 days

Total: ~10-13 days
