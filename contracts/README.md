# Neo N3 Smart Contracts

Neo N3 contracts for the MiniApp platform. Blueprint constraints:

- **Payments/settlement:** GAS only
- **Governance:** NEO only

The target architecture is the registry-anchored engine estate in
[`docs/platform-contract-library-v2.md`](../docs/platform-contract-library-v2.md):
a **PlatformRegistry** spine (permissionless `registerApp`, a minted
**AppAccount** treasury per app, a timelocked engine table) with per-domain
engine contracts registered as rows, absorbing today's per-app contracts
cohort by cohort. That refactor is in flight — the inventory below is what
actually compiles at HEAD.

## Contract Inventory

### Platform suite (`contracts/platform/`)

| Contract | Purpose |
| --- | --- |
| **PlatformRegistry** | v2 spine (landed 2026-07-16/17): permissionless fee-paid `registerApp`, AppAccount minting, timelocked engine table, role-bound treasury lanes, 24h-timelocked governance |
| **AppAccount** | Canonical per-app treasury shim (landed 2026-07-16/17): one audited NEF deployed per registered app by the registry; accept-only NEP-17 callback, registry-relayed `executeTransfer`, `escapeExecute` exit hatch |
| **MiniAppFactory** | Template registry + digest-verified `ContractManagement.Deploy` factory (live: asset-factory, nft-factory, miniapp-factory) |
| **PlatformAnchor** | Shared manual AA-agent routing anchor for TrustAnchor/ProfitAnchor (live: 5 apps; the fleet's only permissionless registration lane) |
| **PlatformGame** | Multi-tenant game engine hosting Countdown, CoinFlip, Gacha, and Dice modules (deployed, no live bindings; v2 evolves it in place with a RewardGame module) |
| **PlatformDeFi** | Lending, flash loan, capsule, and credit engine (testnet deployment, no live bindings) |
| **PlatformSocial** | Red-envelope/range-pool, trust, and vault modules (no deployment record) |

### Legacy per-app contracts (`contracts/MiniApp*/`)

34 per-app `MiniApp*` projects still compile in this directory. They are **not
archived** — there is no `contracts/_archive/` — they are the legacy estate
pending absorption into the v2 engine estate (per-app parameters become
registry descriptor rows; see the migration cohorts in the design doc):

| | | |
| --- | --- | --- |
| MiniAppAimMaster | MiniAppFlappyDash | MiniAppRedEnvelope |
| MiniAppBreakupPact | MiniAppGame2048 | MiniAppSelfLoan |
| MiniAppBurnLeague | MiniAppGasBox | MiniAppSheepSolitaire |
| MiniAppCoinFlip | MiniAppGasBoxV2 | MiniAppSnakeBounty |
| MiniAppCoinFlipV2 | MiniAppGovMerc | MiniAppSoulboundCertificate |
| MiniAppColorClash | MiniAppJumpRush | MiniAppSudoku |
| MiniAppCredits | MiniAppLastSurvivor | MiniAppTarot |
| MiniAppCurveArrow | MiniAppMergeKingdom | MiniAppTarotVrf |
| MiniAppDailyCheckin | MiniAppMilestoneEscrow | MiniAppTimeCapsule |
| MiniAppDiceGame | MiniAppMultisig | MiniAppTipJar |
| MiniAppDiceGameV2 | MiniAppPetPotion | |
| MiniAppEventTicketPass | MiniAppQuadraticFunding | |

### Shared base library (`contracts/MiniApp.DevPack/`)

Neo N3 has no deployed-code inheritance, so sharing happens at source level
via `Compile Include`:

- `MiniAppCompactBase.cs` — minimal admin/pause/gateway helpers + direct
  upgrade controls; the base most current miniapp contracts build on
- `MiniAppMoneyBase.cs` — prepaid GAS credit ledger, witness-gated refund,
  assert-checked transfer, bounded randomness roll (for new standalone
  contracts)
- `MiniAppHouseGameBase(.Settle).cs` — commit/reveal settlement engine for
  house-banked games (CoinFlipV2, DiceGameV2)

### Test fixtures

Six in-repo fixture projects exist only to support the test suite:
`DeployerProbeFixture`, `EngineMockFixture`, `GameOracleMockFixture`,
`ReentrantEngineMockFixture`, `RegistryMockFixture`, `TarotOracleMockFixture`.

## Toolchain

- **.NET 10** + **nccs 3.9.1** (`Neo.Compiler.CSharp` dotnet tool). nccs
  needs `DOTNET_ROOT`, e.g. `export DOTNET_ROOT=~/.dotnet`.
- `contracts/Directory.Build.props` supplies `net10.0`, `Nullable=enable`,
  `Optimize=true`, and the `Neo.SmartContract.Framework` 3.9.1 reference to
  every contract project.

```bash
npm run build:contracts      # bash contracts/build.sh: dotnet build + nccs -> contracts/build/
npm run test:contracts       # dotnet test contracts/__tests__
npm run test:contracts:full  # build + test
```

Build outputs land in `contracts/build/` (`*.nef` + `*.manifest.json`).

## Tests

`contracts/__tests__/` (xunit, `NeoContracts.Tests.csproj`): 66 C# test files
/ 505 test methods — behavioral TestEngine suites per contract, source-security
pin suites, and model-based invariant suites — plus one vitest file
(`platform-contracts-only.test.ts`).

## Test-enforced conventions

Every contract change must keep these suites green:

- **Project shape** (`ContractProjectConventionsTest`): near-empty `.csproj`
  files — no `TargetFramework` / `Nullable` / `Optimize` /
  `Neo.SmartContract.Framework` entries (inherited from
  `contracts/Directory.Build.props`) and no `*.cs` wildcard includes.
- **Reviewable partials**: every `.cs` source file is ≤300 lines; logic is
  split into partial files by workflow instead.
- **No dead markers**: the strings "currently unused", "reserved for future",
  "placeholder", and "stub" are banned in sources; "weight" terminology is
  limited to Gacha-odds files.
- **Update, never destroy** (`ContractUpdateCoverageTest`): every deployable
  contract exposes an admin-gated `update` in its compiled ABI;
  `ContractManagement.Destroy` appears nowhere.
- **Narrow permissions**: `ContractPermission` grants name specific contracts
  and methods — no wildcard `(*, *)`.
- **NEP-17 callback convention** (`OnNep17PaymentConventionTests`):
  `OnNEP17Payment` only validates (caller / memo / amount) and credits the
  ledger — zero outbound transfers inside the callback (an outbound transfer
  there hangs the TestEngine host and couples deposit acceptance to a fragile
  interaction).
- **Role-bound destinations** (`FinancialTransferSafetyTest`): every outbound
  transfer is wrapped in `ExecutionEngine.Assert` and pays a role-bound
  destination (registered payout address, engine hash, witnessing payer,
  admin). The literal parameter `UInt160 recipient` is banned fleet-wide — no
  free-destination spend surface exists.

## Deploy

Chain writes are user actions, always behind the existing confirm-phrase
tooling (`I_UNDERSTAND_THIS_WRITES_CHAIN`) in `deploy/scripts/` (Go + mjs
deploy/validate helpers such as `deploy_selected_miniapp_contracts.go`,
`deploy_anchor_testnet.go`, `deploy_platform_game.go`,
`calc_contract_hashes.go`). See `deploy/` and `docs/LOCAL_DEV.md` for Neo
Express / testnet workflows.

Note: `deploy/scripts/deploy_all.sh` still carries an old roster (Governance,
PriceFeed, AppRegistry, AutomationAnchor, and the per-service OS contracts)
whose sources no longer exist in this repo; it skips anything not built, so
it is effectively a no-op for the current estate.
