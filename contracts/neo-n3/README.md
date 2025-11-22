# Neo N3 Contracts (C# devpack stubs)

Early scaffolding for a modular contract set:
- `Manager.cs`: stores module hashes, roles, and pause flags; emits upgrade/role events.
- `JAMInbox.cs`: records JAM receipts and accumulator roots per service.

These stubs show storage layout, events, and method signatures. Wire role checks to your chosen admin/multisig, and extend with remaining modules (`AccountManager`, `DataFeedHub`, `SecretsVault`) as needed.
Included stubs so far:
- Manager (module hashes, roles, pause flags)
- ServiceRegistry
- OracleHub
- JAMInbox
- AutomationScheduler
- RandomnessHub
- DataFeedHub
- SecretsVault
- AccountManager

See `DEPLOY.md` for a high-level deploy/wiring outline (register module hashes in Manager, grant roles, and resolve module hashes from Manager in clients).

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
