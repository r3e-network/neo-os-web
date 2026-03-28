# Service Gateway Module Registry Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `ServiceGateway` accept only module contracts that are actively registered in `ModuleRegistry`, so shared miniapp bindings move from “any deployed contract” toward “platform-approved composable modules”.

**Architecture:** Keep this slice intentionally narrow. `ModuleRegistry` becomes authoritative for active module hashes via a hash-indexed safe lookup, and `ServiceGateway` consumes that registry instead of relying on `ContractManagement.GetContract(...)` alone. This does not yet enforce full recipe graphs; it establishes the first authoritative registry gate the rest of the modular model can build on.

**Tech Stack:** Neo N3 C# smart contracts, xUnit source-assertion tests in `contracts/__tests__`, Vitest contract-tree smoke for repo hygiene.

### Task 1: Add Failing Contract Tests For Registry-Backed Module Validation

**Files:**
- Modify: `contracts/__tests__/ModularCapabilityRegistriesTest.cs`
- Create: `contracts/__tests__/ServiceGatewayRegistryEnforcementTest.cs`

**Step 1: Write the failing test**

Add source-level assertions that require:
- `ModuleRegistry` to expose a safe method for active lookup by contract hash
- `ServiceGateway` to call into `ModuleRegistry` instead of only checking deployment existence

**Step 2: Run test to verify it fails**

Run:

```bash
dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter "FullyQualifiedName~ModularCapabilityRegistriesTest|FullyQualifiedName~ServiceGatewayRegistryEnforcementTest"
```

Expected: FAIL because the new lookup API and enforcement call do not exist yet.

### Task 2: Implement Active Module Hash Indexing In ModuleRegistry

**Files:**
- Modify: `contracts/ModuleRegistry/ModuleRegistry.cs`

**Step 1: Write minimal implementation**

Add:
- storage for contract-hash-to-module-key lookup
- safe `IsModuleActive(UInt160 contractHash)` API
- index maintenance inside `UpsertModule(...)` and `SetModuleActive(...)`

Keep the existing API intact.

**Step 2: Run targeted tests**

Run:

```bash
dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter "FullyQualifiedName~ModularCapabilityRegistriesTest"
```

Expected: PASS

### Task 3: Make ServiceGateway Require Registry-Active Modules

**Files:**
- Modify: `contracts/ServiceGateway/ServiceGateway.cs`
- Test: `contracts/__tests__/ServiceGatewayRegistryEnforcementTest.cs`

**Step 1: Write minimal implementation**

Update `ValidateModuleRegistered(...)` to:
- keep bootstrap bypass when module registry is unset
- otherwise call the module registry safe method
- assert that the bound module hash is active in `ModuleRegistry`

**Step 2: Run targeted tests**

Run:

```bash
dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter "FullyQualifiedName~ServiceGatewayRegistryEnforcementTest"
```

Expected: PASS

### Task 4: Run Full Focused Verification

**Files:**
- Test: `contracts/__tests__/ModularCapabilityRegistriesTest.cs`
- Test: `contracts/__tests__/ServiceGatewayRegistryEnforcementTest.cs`
- Test: `contracts/__tests__/platform-contracts-only.test.ts`

**Step 1: Run verification**

Run:

```bash
dotnet test contracts/__tests__/NeoContracts.Tests.csproj --filter "FullyQualifiedName~ModularCapabilityRegistriesTest|FullyQualifiedName~ServiceGatewayRegistryEnforcementTest"
node node_modules/vitest/vitest.mjs run contracts/__tests__/platform-contracts-only.test.ts
git diff --check
```

Expected: PASS
