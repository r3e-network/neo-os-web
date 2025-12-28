# MiniAppContract - Shared Code Library

This directory contains reusable code for all MiniApp contracts using C# partial classes.

## Architecture

Neo smart contracts don't support abstract class inheritance, so we use **partial classes** to share common code across all MiniApp contracts.

```
┌─────────────────────────────────────────────────────────────┐
│                    MiniAppContract.Core.cs                       │
│  (Shared partial class with common functionality)            │
├─────────────────────────────────────────────────────────────┤
│  • Standard Storage Prefixes (0x01-0x05)                    │
│  • Standard Getters (Admin, Gateway, PaymentHub, etc.)      │
│  • Validation Methods (ValidateAdmin, ValidateGateway)      │
│  • Admin Management (SetAdmin, SetGateway, SetPaused, etc.) │
│  • Global Pause Check (ValidateNotGloballyPaused)           │
│  • Contract Update                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ partial class
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              MiniApp Contract (e.g., CoinFlip)               │
│  (App-specific partial class)                                │
├─────────────────────────────────────────────────────────────┤
│  • App Constants (APP_ID, fees, etc.)                       │
│  • App Prefixes (0x10+)                                     │
│  • App Events                                                │
│  • App Getters                                               │
│  • _deploy (lifecycle)                                       │
│  • Business Logic                                            │
└─────────────────────────────────────────────────────────────┘
```

## Files

### MiniAppContract.Core.cs

Core shared functionality for all MiniApp contracts. Includes:

- **Standard Storage Prefixes** (0x01-0x05 reserved):
  - `PREFIX_ADMIN` (0x01)
  - `PREFIX_GATEWAY` (0x02)
  - `PREFIX_PAYMENTHUB` (0x03)
  - `PREFIX_PAUSED` (0x04)
  - `PREFIX_PAUSE_REGISTRY` (0x05)

- **Standard Getters**:
  - `Admin()` - Get admin address
  - `Gateway()` - Get gateway address
  - `PaymentHub()` - Get payment hub address
  - `PauseRegistry()` - Get pause registry address
  - `IsPaused()` - Check local pause state

- **Validation Methods**:
  - `ValidateAdmin()` - Require admin witness
  - `ValidateGateway()` - Require gateway caller
  - `ValidateAddress(addr)` - Validate address
  - `ValidateNotPaused()` - Check local pause
  - `ValidateNotGloballyPaused(appId)` - Check global + local pause

- **Admin Management**:
  - `SetAdmin(newAdmin)`
  - `SetGateway(gw)`
  - `SetPaymentHub(hub)`
  - `SetPauseRegistry(registry)`
  - `SetPaused(paused)`
  - `Update(nef, manifest)`

### MetricEventCompact.cs / MetricEvent.cs

Platform_Metric event for emitting custom business metrics.

### NotificationEventCompact.cs / NotificationEvent.cs

Platform_Notification event for user-facing notifications.

## Creating a New MiniApp Contract

1. Create your contract file with `partial class MiniAppContract`:

```csharp
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    [DisplayName("MiniAppYourApp")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Your app description")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "builtin-yourapp";
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_YOUR_DATA = new byte[] { 0x10 };
        #endregion

        #region App Events
        // Define your events here
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            // Initialize app-specific state
        }
        #endregion

        #region App Logic
        public static void YourMethod()
        {
            ValidateNotGloballyPaused(APP_ID);
            // Your business logic
        }
        #endregion
    }
}
```

2. The build script automatically includes `MiniAppContract.Core.cs` when compiling.

## Build Process

The `build.sh` script uses `build_miniapp()` function which automatically includes:

- `MiniAppContract/MiniAppContract.Core.cs`
- Your app's `.cs` files

```bash
# Automatic compilation with shared files
./build.sh

# Manual compilation
nccs MiniAppContract/MiniAppContract.Core.cs YourMiniApp/YourContract.cs -o build/
```

## Storage Prefix Convention

| Range     | Usage                            |
| --------- | -------------------------------- |
| 0x01-0x05 | Reserved for MiniAppContract.Core.cs |
| 0x10-0xFF | App-specific storage             |

## Benefits

1. **DRY Principle**: Common code defined once
2. **Consistency**: All MiniApps have identical admin/gateway management
3. **Maintainability**: Fix bugs in one place
4. **Smaller Contracts**: Less code duplication
5. **Global Pause**: Built-in support for PauseRegistry

## Migration from Old Pattern

If you have an existing MiniApp contract:

1. Change `public class MiniAppXxx : SmartContract` to `public partial class MiniAppContract : SmartContract`
2. Remove these sections (now in Core.cs):
   - Standard Prefixes (PREFIX_ADMIN, PREFIX_GATEWAY, etc.)
   - Standard Getters (Admin(), Gateway(), etc.)
   - Standard Validation (ValidateAdmin, ValidateGateway)
   - Admin Management (SetAdmin, SetGateway, etc.)
   - Update method
3. Add `APP_ID` constant
4. Update `_deploy` to use `PREFIX_ADMIN` from Core.cs
5. Use `ValidateNotGloballyPaused(APP_ID)` for pause checks
