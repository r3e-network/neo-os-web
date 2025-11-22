# Deploying the Neo N3 Contract Set (outline)

1) Build artifacts with neo-devpack
- Compile each stub (`Manager`, `ServiceRegistry`, `AccountManager`, `SecretsVault`, `AutomationScheduler`, `OracleHub`, `RandomnessHub`, `DataFeedHub`, `JAMInbox`) using `dotnet build` with Neo devpack.
- Capture contract hashes after deploy (use `neocli` or the tool of your choice).

2) Deploy Manager first
- Use a multisig or designated admin account.
- Record the Manager contract hash for later role checks.

3) Deploy modules
- Deploy each module contract and note its hash.
- Recommended order: ServiceRegistry, AccountManager, SecretsVault, AutomationScheduler, OracleHub, RandomnessHub, DataFeedHub, JAMInbox.

4) Register module hashes in Manager
- Call `Manager.SetModule(name, hash)` for each module (e.g., `"service_registry"`, `"account_manager"`, `"secrets_vault"`, `"automation_scheduler"`, `"oracle_hub"`, `"randomness_hub"`, `"datafeed_hub"`, `"jam_inbox"`).
- Grant roles: `GrantRole(<runner>, RoleOracleRunner)`, `GrantRole(<runner>, RoleRandomnessRunner)`, `GrantRole(<runner>, RoleJamRunner)`, etc.
- Optionally pause modules until configuration is complete.

5) Configure services
- Use `ServiceRegistry.Register` to record services, code hash, config hash, and capabilities.
- Link accounts/wallets via `AccountManager`.

6) Operations
- Off-chain agents read module hashes from Manager before invoking to avoid stale addresses.
- Modules can be upgraded by deploying a new hash and calling `SetModule`; downstream callers should always resolve via Manager.
- Use pause flags during maintenance.

Notes
- Role checks in stubs are minimal; wire them to Manager in a production-ready version.
- JAMInbox should be runner-gated; hook its runner role to Manager.***
