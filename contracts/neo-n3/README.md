# Neo N3 Contracts (C# devpack stubs)

Modular contract set for the Service Layer, following Android OS-style architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Contracts                          │
│  (Custom business logic deployed via SDK)                   │
├─────────────────────────────────────────────────────────────┤
│                   Service Contracts                         │
│  OracleHub │ RandomnessHub │ DataFeedHub │ Automation       │
├─────────────────────────────────────────────────────────────┤
│                   Engine Contracts                          │
│  Manager │ AccountManager │ ServiceRegistry │ GasBank       │
└─────────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Purpose | Go Alignment |
|----------|---------|---------------|
| `Manager.cs` | Module hashes, roles, pause flags | `domain/contract/template.go` |
| `AccountManager.cs` | Account/wallet management | `domain/account/`, `system/api/` |
| `ServiceRegistry.cs` | Service registration & capabilities | `domain/contract/contract.go` |
| `GasBank.cs` | Balance management, fee collection | `packages/com.r3e.services.gasbank/`, `system/events/` |
| `OracleHub.cs` | Oracle request/response | `packages/com.r3e.services.oracle/` |
| `RandomnessHub.cs` | VRF randomness | `packages/com.r3e.services.vrf/` |
| `DataFeedHub.cs` | Price feed aggregation | `packages/com.r3e.services.datafeeds/` |
| `AutomationScheduler.cs` | Job scheduling | `packages/com.r3e.services.automation/` |
| `SecretsVault.cs` | Encrypted secrets | `packages/com.r3e.services.secrets/` |
| `JAMInbox.cs` | Cross-chain messaging | `packages/com.r3e.services.ccip/` |

## Go SDK Integration

The Go SDK (`sdk/go/contract/`) provides a developer-friendly interface:

```go
import "github.com/R3E-Network/service_layer/sdk/go/contract"

spec := contract.NewSpec("MyService").
    WithCapabilities(contract.CapOracleRequest, contract.CapGasBankRead).
    WithMethod("processData", []contract.Param{{Name: "data", Type: "bytes"}}, nil).
    Build()
```

## Role ↔ Capability Mapping

| C# Role | Byte | Go Capability |
|---------|------|---------------|
| `RoleAdmin` | 0x01 | (admin-only) |
| `RoleScheduler` | 0x02 | `CapAutomation` |
| `RoleOracleRunner` | 0x04 | `CapOracleProvide` |
| `RoleRandomnessRunner` | 0x08 | `CapVRFProvide` |
| `RoleJamRunner` | 0x10 | `CapCrossChain` |
| `RoleDataFeedSigner` | 0x20 | `CapFeedWrite` |

## Wiring role checks to Manager (example)

To gate runner/admin calls via Manager instead of bare `CheckWitness`, store the Manager hash in contract storage (or hardcode for testing) and use `Contract.Call`:

```csharp
private static readonly StorageMap Config = new(Storage.CurrentContext, "cfg:");

public static void SetManager(UInt160 hash)
{
    if (!Runtime.CheckWitness((UInt160)Runtime.CallingScriptHash)) throw new Exception("admin only");
    Config.Put("manager", hash);
}

private static bool HasRole(UInt160 account, byte role)
{
    var mgr = (UInt160)Config.Get("manager");
    if (mgr is null || mgr.Length == 0) return false;
    var res = (bool)Contract.Call(mgr, "HasRole", CallFlags.ReadOnly, account, role);
    return res;
}
```

Use this helper inside `RequireRunner`/`RequireOwner` in the stubs to align with Manager-issued roles.

See `DEPLOY.md` for a high-level deploy/wiring outline and `docs/contract-system.md` for full architecture documentation.
