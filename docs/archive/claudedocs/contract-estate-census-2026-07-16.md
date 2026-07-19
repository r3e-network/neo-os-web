# Platform Contract Estate Census (2026-07-16, HEAD 020b53d87)

Six read-only census lanes over contracts/, deploy/, framework bindings. Raw structured results.



## Lane 1

### Compile toolchain: nccs 3.9.1 + dotnet 10 + shared build props

FACTS: Contracts target net10.0 with Nullable enable and Optimize true supplied ONLY by contracts/Directory.Build.props, which also injects Neo.SmartContract.Framework 3.9.1 for every non-test project. Compiler is Neo.Compiler.CSharp (nccs) 3.9.1 (verified locally: 3.9.1+5fa9566e; CI installs `dotnet tool install --global Neo.Compiler.CSharp --version 3.9.1`; local dotnet SDK 10.0.108, CI setup-dotnet 10.0.x). contracts/build.sh compiles every csproj at depth 2-3 (excluding __tests__) with `dotnet build -c Release` then `~/.dotnet/tools/nccs <csproj> --optimize=All --output ./build/`. The tarot release script additionally passes `--checked` and hard-asserts nccs version prefix 3.9.1 — build.sh does NOT pass --checked, an inconsistency to resolve in the redesign. nccs on macOS needs DOTNET_ROOT (e.g. /opt/homebrew/opt/dotnet/libexec) or it dies with 'You must install .NET'. npm wiring: build:contracts=bash contracts/build.sh, test:contracts=dotnet test contracts/__tests__ (DOTNET_ROOT defaulted to ~/.dotnet), test:contracts:full chains both.

EVIDENCE: contracts/Directory.Build.props:3-9; contracts/build.sh:9-14; deploy/scripts/build_tarot_vrf.sh:11-33; .github/workflows/ci.yml:77-99; package.json:47-49

DESIGN IMPLICATION: Every new platform contract compiles through the same lane: bare csproj + shared props + nccs 3.9.1 into contracts/build/. Decide once whether --checked becomes fleet-wide (it is currently per-contract folklore).

### csproj conventions (test-enforced)

FACTS: ContractProjectConventionsTest fails any contract csproj that contains a backslash, `<TargetFramework>`, `<Nullable>`, `<Optimize>`, or a direct Neo.SmartContract.Framework reference (must rely on shared Directory.Build.props), and any non-test csproj containing the literal `*.cs` (no wildcard Compile includes, for nccs compatibility). Real shapes: platform contracts and MiniAppCredits use an empty `<Project Sdk="Microsoft.NET.Sdk"></Project>` (SDK default globbing is fine — only explicit `*.cs` wildcards are banned); contracts inheriting the DevPack base add `<Compile Include="../MiniApp.DevPack/MiniAppContractUsings.cs" Link=.../>` + `MiniAppCompactBase.cs`; MiniAppTarotVrf sets EnableDefaultCompileItems=false and lists every partial explicitly.

EVIDENCE: contracts/__tests__/ContractProjectConventionsTest.cs:13-51; contracts/__tests__/ContractProjectConventionsTest.cs:54-76; contracts/MiniAppCredits/MiniAppCredits.csproj:1-2; contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.csproj:2-6; contracts/MiniAppTarotVrf/MiniAppTarotVrf.csproj:2-15

DESIGN IMPLICATION: New platform contract = new folder contracts/platform/<Name>/ with a near-empty csproj; put nothing toolchain-related in it.

### Source hygiene conventions (test-enforced)

FACTS: Three fleet-wide source gates over every non-test .cs under contracts/: (1) every file <= 300 lines ('stay small enough for security review' — forces partial-class splitting, e.g. PlatformGame.Dice.Internal.cs was split for exactly this budget per ContractSecurityRegressionTest comment); (2) banned placeholder markers anywhere, case-insensitive: 'currently unused', 'reserved for future', 'placeholder', 'stub'; (3) 'weight/weights/weighted' terminology banned outside PlatformGame.Gacha* and MiniAppGasBox* files.

EVIDENCE: contracts/__tests__/ContractProjectConventionsTest.cs:78-98; contracts/__tests__/ContractProjectConventionsTest.cs:100-131; contracts/__tests__/ContractProjectConventionsTest.cs:133-168; contracts/__tests__/ContractSecurityRegressionTest.cs:155-160

DESIGN IMPLICATION: Plan platform contracts as many <=300-line partials from day one (PlatformGame/PlatformSocial already follow Name.Domain.cs partial naming); never commit scaffold comments.

### Update()/upgrade coverage (test-enforced, two layers)

FACTS: Layer 1 (ABI-level): every contracts/build/MiniApp*.manifest.json except *Fixture* must expose an `update` method — checked against compiled artifacts, so it gates the actual manifest. Layer 2 (source-level): the four dedicated miniapp contracts must inherit `: MiniAppBase` whose Update() does ValidateAdmin() + ContractManagement.Update (MiniAppCompactBase.cs:149-153); platform contracts are enumerated by name — PlatformAnchor, PlatformDeFi, PlatformGame, PlatformSocial — and must each expose `public static void Update` + ValidateAdmin() + ContractManagement.Update. ContractManagement.Destroy is forbidden in the base (and in MiniAppCredits, per its own suite). Also: dedicated miniapp contracts must NOT request wildcard permissions on native GAS (0xd2a4cf...) or NEO (0xef4073...).

EVIDENCE: contracts/__tests__/ContractProjectConventionsTest.cs:170-201; contracts/__tests__/ContractUpdateCoverageTest.cs:7-64; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:149-153; contracts/__tests__/ContractSecurityRegressionTest.cs:185-194; contracts/__tests__/MiniAppCreditsSourceSecurityTests.cs:110-118

DESIGN IMPLICATION: Every new platform contract must (a) expose admin-gated update, (b) never expose destroy, (c) be ADDED to ContractUpdateCoverageTest's InlineData registry, and (d) declare minimal ContractPermissions (named methods, never (*,*)).

### Money-contract registry + OnNEP17Payment convention

FACTS: The registry of self-contained money contracts is OnNep17PaymentConventionTests.MoneyContracts() — 28 entries mapping contract name to the source file holding its OnNEP17Payment. The pinned convention (born from the self-loan v1 crash): OnNEP17Payment ONLY validates caller/memo/amount and credits a ledger; it must contain NO outbound transfer (regexes `\.Transfer\s*\(` and `"transfer(From)?"` over the brace-balanced method body); all fund movement lives in direct witness-gated methods. ReviewedTransferExceptions is currently EMPTY and self-policing (a stale exception fails the test). Platform* kernel contracts are explicitly out of scope of this list; MiniAppCredits' companion suite pins the same rule plus ordering (pause gate BEFORE the GAS-caller gate) at source level. Memo idioms: base helper requires memo prefix `{appId}:`; MiniAppCredits uses fixed memo 'miniapp-credits:buy'.

EVIDENCE: contracts/__tests__/OnNep17PaymentConventionTests.cs:36-66; contracts/__tests__/OnNep17PaymentConventionTests.cs:9-25; contracts/__tests__/OnNep17PaymentConventionTests.cs:78-116; contracts/__tests__/MiniAppCreditsSourceSecurityTests.cs:24-47; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:163-177

DESIGN IMPLICATION: Any new contract that receives NEP-17 funds must be registered in MoneyContracts() (or covered by FinancialTransferSafetyTest if it's a Platform* kernel) and must follow credit-only callbacks — deposits credit a ledger, payouts are separate witness-gated pulls.

### Financial transfer safety conventions for platform contracts

FACTS: FinancialTransferSafetyTest pins, per platform domain: (1) every outbound GAS/NEO.Transfer wrapped in ExecutionEngine.Assert; (2) payout destinations are hard-bound to domain roles (borrower, capsule.Owner, claimer, pool.Creator, trust.Heir, bet.Player, play.Player, round.LastBuyer) — the literal string 'UInt160 recipient' is banned across PlatformDeFi/PlatformSocial/PlatformGame partials, i.e. no free-destination transfer method may exist; (3) ContractPermission must be narrow (PlatformDeFi must NOT have (*,*), must have (*, getSelectedCandidate, onFlashLoan)); (4) push-payment to contract accounts that might reject GAS is avoided via pull-payment credit ledgers (Countdown winner gets AddDirectGasCredit, and GAS.Transfer-to-winner is explicitly asserted ABSENT); (5) flash loan requires provider witness, callback name pinned, and post-loan balance check contractGasAfter == before + fee, plus a REENTRANCY guard marker.

EVIDENCE: contracts/__tests__/FinancialTransferSafetyTest.cs:7-58; contracts/__tests__/FinancialTransferSafetyTest.cs:86-138; contracts/__tests__/ContractSecurityRegressionTest.cs:128-140

DESIGN IMPLICATION: The redesign's shared platform contracts must adopt: assert-wrapped transfers, role-bound payout destinations (no generic recipient param anywhere), pull-payment credit ledgers for winner/prize flows, and minimal manifest permissions — and add matching pins to FinancialTransferSafetyTest for each new money path.

### Anchor-style invariants: user-witness custody + accounting models

FACTS: AnchorBoundarySafetyTest pins: user Withdraw/ClaimRewards/WithdrawCredit require Runtime.CheckWitness(user) and transfers go to `user` (transfers to Admin()/GetAppAdmin are asserted absent); admin can never harvest user gas credits (solvency check GetTotalRewardReserve()+GetTotalGasCredit()+amount); agent moves stay inside the same app and need agent-execution witness; apps self-register with app-admin witness and duplicate registration is rejected. AnchorRewardAccountingInvariantTest adds: pause never blocks user exit (Withdraw/ClaimRewards must NOT call ValidateAnchorOpen), scaled-remainder reward math (REWARD_SCALE=1e8, remainder carried per app), and — notably — pure-C# model-based invariant tests: a 500-step randomized stake/withdraw/fund/claim sequence asserting conservation (TotalClaimed <= TotalFunded, reserve == funded-claimed, reserve >= 0) and a multi-app pool model proving no cross-app reserve double-counting.

EVIDENCE: contracts/__tests__/AnchorBoundarySafetyTest.cs:7-61; contracts/__tests__/AnchorBoundarySafetyTest.cs:63-73; contracts/__tests__/AnchorRewardAccountingInvariantTest.cs:29-41; contracts/__tests__/AnchorRewardAccountingInvariantTest.cs:117-168

DESIGN IMPLICATION: For any new shared platform contract holding pooled user funds, the DoD includes: user-witnessed exits that survive pause, admin-cannot-touch-user-funds source pins, per-app accounting isolation, and a C# reference-model invariant test with randomized sequences.

### TestEngine testing idioms (Neo.SmartContract.Testing 3.9.1)

FACTS: Test project: contracts/__tests__/NeoContracts.Tests.csproj — Neo.SmartContract.Testing 3.9.1, xunit 2.6.2, Microsoft.NET.Test.Sdk 17.8.0, coverlet 6.0.0 (PlatformGameComprehensiveTests.cs is Compile-Removed pending the concurrent PlatformGame rework). Fixture idiom: (1) tests load the REAL nccs-compiled artifacts from contracts/build via AppContext.BaseDirectory+'../../../../build' (NefFile.Parse + ContractManifest.Parse); (2) declare an abstract class extending Neo.SmartContract.Testing.SmartContract with camelCase abstract members mirroring the ABI; (3) `new TestEngine(true)`, `engine.SetTransactionSigners(engine.ValidatorsAddress)`, `engine.Deploy<T>(nef, manifest)`; fund actors via engine.Native.GAS.Transfer; purchases are literal GAS transfers with a memo; reverts asserted as 'ABORTMSG is executed. Reason: {msg}'. Cross-contract gates are tested with compiled mock fixtures (GameOracleMockFixture deployed in-engine so caller==Oracle() is a real cross-contract check; *Fixture names are exempt from the update-method gate). Hard limitation shaping the architecture: a FAULTing OnNEP17Payment inside a GAS transfer HANGS the TestEngine host — so rejection paths are pinned by companion source-security tests (regex/brace-balanced body extraction, ordering assertions like pause-before-caller-gate and Storage.Delete-before-transfer CEI) and exercised via direct invocation instead.

EVIDENCE: contracts/__tests__/NeoContracts.Tests.csproj:15-23; contracts/__tests__/MiniAppCreditsTests.cs:13-83; contracts/__tests__/GameOracleMockFixture.cs:12-56; contracts/__tests__/MiniAppCreditsTests.cs:140-144; contracts/__tests__/MiniAppCreditsSourceSecurityTests.cs:8-15; contracts/__tests__/MiniAppMoneyBaseTests.cs:22-27

DESIGN IMPLICATION: Every new platform contract ships three test layers: TestEngine behavioral suite against the compiled NEF, a source-security pin suite for paths TestEngine cannot exercise, and (for pooled funds) a model-based invariant suite. ContractSourceAssertions.cs provides the shared helpers (FindRepoRoot, ReadSourcesByPattern, AssertHasPublicStaticMethod with comment stripping).

### Shared base classes available (MiniApp.DevPack)

FACTS: contracts/MiniApp.DevPack holds the reusable bases compiled INTO each contract via Compile Include links (not a referenced assembly): MiniAppCompactBase.cs (274 lines — abstract MiniAppBase: storage prefixes 0x01 admin/0x02 oracle/0x04 paused/0x05 pause-registry/0x06 gateway, 0x70/0x71 direct gas/asset credit; ValidateAdmin/ValidateAddress/ValidateNotGloballyPaused; SetOracle/SetPauseRegistry/SetGateway assert the target is a deployed contract (audit NEW-I-2); admin-gated Update; memo-gated CreditDirectGasPayment requiring `{appId}:` prefix; witness-gated CEI ReclaimDirectAssetCredit), MiniAppMoneyBase.cs (129 lines, proven by MiniAppMoneyBaseTests via the compiled MiniAppMoneyBaseFixture), MiniAppHouseGameBase.cs+Settle (228+162 lines), MiniAppContractUsings.cs (4 lines of global usings). Convention documented in README: app-specific storage prefixes start at 0x10.

EVIDENCE: contracts/MiniApp.DevPack/MiniAppCompactBase.cs:18-27; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:107-153; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:163-177; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:249-271; contracts/__tests__/MiniAppMoneyBaseTests.cs:22-27; contracts/README.md:65-71

DESIGN IMPLICATION: The redesign can extend this source-inclusion DevPack pattern for platform-side shims; note the base deliberately cannot declare events (Neo DevPack limitation) — each concrete contract must declare typed role-change events itself (documented follow-up in MiniAppCompactBase.cs:98-106).

### Deploy & registration pipeline (how apps bind contracts)

FACTS: Binding is by static table + manifest write-back, not on-chain registry: deploy_selected_miniapp_contracts.go (`//go:build scripts`, run via `go run -tags=scripts`) holds a 34-row deployTargets table mapping contract name -> contracts/build/{Name}.nef+manifest -> apps/<app>/neo-manifest.json. Safety rails: MINIAPP_DEPLOY_NETWORK (testnet default) with pinned magics (testnet 894710606, mainnet 860833102) verified against the RPC node; writes require CONFIRM_SELECTED_MINIAPP_DEPLOY=I_UNDERSTAND_THIS_WRITES_CHAIN; MINIAPP_DEPLOY_TARGETS filters; expected hash precomputed via state.CreateContractHash(deployer, nef.Checksum, manifest.Name); idempotent skip if already deployed; post-deploy conditional wiring calls setOracle/setTeeSigner/setAbstractAccount/setAutomationAnchor only if the on-chain ABI exposes them, config resolved from env or the sibling neo-morpheus-oracle repo; finally writes the hash into the app's neo-manifest.json under 'neo-n3-testnet'/'neo-n3-mainnet' (verified shape: apps/color-clash/neo-manifest.json contracts.neo-n3-testnet=0xb2d0...) and a JSON report to contracts/build/selected_miniapps_redeployed_<net>.json. In-place upgrades use update_miniapp_contracts.go (same confirm phrase, own target table, tracks on-chain update counters). Platform contracts have dedicated deployers (deploy_platform_game.go with CONFIRM_PLATFORM_GAME_DEPLOY + per-appId game-type registration records; deploy_anchor_testnet/mainnet.go). CI gate: .github/workflows/ci.yml 'contracts' job recompiles all NEFs with nccs 3.9.1 then runs the full xUnit/TestEngine suite.

EVIDENCE: deploy/scripts/deploy_selected_miniapp_contracts.go:32-36; deploy/scripts/deploy_selected_miniapp_contracts.go:54-89; deploy/scripts/deploy_selected_miniapp_contracts.go:104-111; deploy/scripts/deploy_selected_miniapp_contracts.go:183,200,218-253; deploy/scripts/deploy_selected_miniapp_contracts.go:613-641; deploy/scripts/update_miniapp_contracts.go:68-82; deploy/scripts/deploy_platform_game.go:31-45; apps/color-clash/neo-manifest.json; .github/workflows/ci.yml:77-99

DESIGN IMPLICATION: A new platform contract needs: a deployer (or a row in a target table) with confirm-phrase + magic-check + predicted-hash + idempotency + post-deploy role wiring, and the app-binding story stays 'hash written into neo-manifest.json contracts.<network>'. The zero-deploy vision changes the LAST step only: apps would bind the shared platform hash instead of a per-app one.

### Inactive/stale gates and docs (honesty notes)

FACTS: (1) ContractBuildWarningsTest is now an explicit placeholder (Assert.True(true)) — warning bans died with the contracts they validated, so 'no build warnings' is currently NOT an enforced gate despite being named in the lane brief. (2) contracts/README.md is substantially stale: it documents Governance/PriceFeed/RandomnessLog/AppRegistry/AutomationAnchor platform contracts and '60 Deployed' phase tables whose source directories do not exist in contracts/ (current platform dirs are only MiniAppFactory, PlatformAnchor, PlatformDeFi, PlatformGame, PlatformSocial), and deploy_all.sh's neo-express list (Governance, FundingVault, StreamVesting, ...17 names) references contracts that are not in the tree. (3) SECURITY_CHECKLIST.md links to ../contracts/MiniAppBase/MiniAppBase.Core.cs which does not exist (the real base is MiniApp.DevPack/MiniAppCompactBase.cs). (4) contracts/build currently holds 95 files (~47 contract NEF+manifest pairs incl. fixtures) and compiled artifacts ARE committed — tests and the update gate read them directly.

EVIDENCE: contracts/__tests__/ContractBuildWarningsTest.cs:5-17; contracts/README.md:41-51,250-258; deploy/scripts/deploy_all.sh:161-177; contracts/SECURITY_CHECKLIST.md:184-185; contracts/platform (dir listing: MiniAppFactory, PlatformAnchor, PlatformDeFi, PlatformGame, PlatformSocial)

DESIGN IMPLICATION: The redesign's definition-of-done should be sourced from the test suite, not the README; budget a docs-truthing pass, and decide whether to resurrect a real build-warnings gate (the current one is vacuous).

### LANE SUMMARY
Definition-of-done for a contract in this repo, extracted from contracts/__tests__ infrastructure tests + build/deploy scripts. CONVENTIONS a new platform contract must satisfy: near-empty csproj relying on contracts/Directory.Build.props (net10.0, Nullable, Optimize, Neo.SmartContract.Framework 3.9.1; per-project TargetFramework/Nullable/Optimize/framework-refs and `*.cs` wildcard includes are test-banned); every source file <=300 lines (forces partial splitting); no placeholder/stub/reserved-for-future markers; 'weight' terminology only in gacha files; admin-gated update() in the compiled ABI and ContractManagement.Update+ValidateAdmin in source (platform contracts are individually enumerated in ContractUpdateCoverageTest — new ones must be added); no ContractManagement.Destroy; no wildcard native-token permissions; money contracts register in OnNep17PaymentConventionTests.MoneyContracts() (28 entries — the registry) and their OnNEP17Payment must be validate+credit-only with zero outbound transfers; platform money paths additionally pinned by FinancialTransferSafetyTest (assert-wrapped transfers, role-bound payouts, banned 'UInt160 recipient', pull-payment credit ledgers, narrow ContractPermission) and anchor invariants (user-witnessed pause-immune exits, admin-cannot-harvest, model-based conservation tests). TESTING: xUnit + Neo.SmartContract.Testing 3.9.1 loading the committed nccs artifacts from contracts/build (abstract camelCase binding class, TestEngine(true), SetTransactionSigners, Deploy<T>, ABORTMSG revert asserts, compiled mock fixtures for cross-contract gates); FAULTing NEP-17 callbacks hang TestEngine, so rejection paths get companion source-security pin suites. BUILD/DEPLOY: contracts/build.sh (dotnet build Release + nccs --optimize=All into contracts/build; tarot lane adds --checked and pins nccs 3.9.1), CI recompiles and runs the full suite with dotnet 10 + nccs 3.9.1; deployment via go-run scripts with static target tables, I_UNDERSTAND_THIS_WRITES_CHAIN confirm phrase, network-magic checks, predicted CreateContractHash, idempotent redeploy-skip, conditional setOracle/setTeeSigner/setAbstractAccount/setAutomationAnchor wiring, and hash write-back into each app's neo-manifest.json contracts.{neo-n3-testnet|mainnet}. Honesty notes: ContractBuildWarningsTest is a vacuous placeholder, and contracts/README.md + deploy_all.sh + SECURITY_CHECKLIST.md reference contracts/paths that no longer exist — trust the tests, not the docs.


## Lane 2

### Kernel identity: two distinct 'generic kernel' embodiments coexist

FACTS: The platform has (A) PlatformGameContract — a single multi-tenant on-chain game engine hosting 4 wager game types (Countdown=1, CoinFlip=2, Gacha=3, Dice=4) under one deployment, 24 partial files / 3,488 lines; and (B) the Morpheus oracle kernel (external repo neo-morpheus-oracle) — a game-agnostic TEE 'confidential session' host where each skill game is DATA (hash-pinned engine + descriptor in an operator whitelist; session.js has no appId branch, enforced by no-appid-branch.test.mjs). 9 near-identical thin contracts consume kernel B. The design doc explicitly states: 'the oracle is a generic privacy-compute platform; each game is DATA' and 'ZERO per-game code in the oracle'.

EVIDENCE: contracts/platform/PlatformGame/PlatformGame.cs:22-44; contracts/platform/PlatformGame/PlatformGame.cs:65-68; claudedocs/game-miniapps-design.md:3-16; claudedocs/game-miniapps-design.md:40-42

DESIGN IMPLICATION: The zero-deploy redesign has two proven halves to merge: PlatformGame proves multi-tenant scoped storage + registration on-chain; the Morpheus worker proves data-descriptor game config off-chain. Neither half alone finishes the job.

### (1) Lifecycle the PlatformGame kernel owns

FACTS: Per tenant it owns: prepaid GAS/NEO credit (OnNEP17Payment requires memo 'appId:...', credits per appId+payer under prefix 0x70; WithdrawGasCredit reclaim is witness-gated and deliberately works while paused; AddDirectGasCredit is the pull-payment payout lane so a faulting recipient callback can't brick settlement); full bet/round/play lifecycle per module — Dice: PlaceDiceBet (consumes credit, checks payout liquidity, anti-Martingale limits: min 0.05/max 20 GAS, 500 GAS daily, 30s cooldown, 20 consecutive) → oracle VRF → ResolveDiceBetFromOracle (rejection-sampled roll, 6x minus 5% fee) or refund; CoinFlip: PlaceCoinFlipBet/Resolve/Refund + expiry; Gacha: CreateGachaMachine/AddGachaItem/PullGacha/Resolve + inventory payment consumption; Countdown: StartCountdownRound/BuyCountdownKeys (fee split 500/4800/3000/1000/700 bps, rising key price)/CheckAndEndCountdownRound/WithdrawCountdownPlatformFees. It also owns oracle plumbing: RequestOracleForCallback (Contract.Call oracle 'requestFromCallback' with narrowed CallFlags) + OnOracleResult which validates requestType=='vrf_random', loads stored (appId, gameType, operationId) context, dispatches to the right module, and REFUNDS the stake on oracle failure. Per-app reentrancy lock (prefix 0x85).

EVIDENCE: contracts/platform/PlatformGame/PlatformGame.Credit.cs:35-51; contracts/platform/PlatformGame/PlatformGame.Credit.cs:94-136; contracts/platform/PlatformGame/PlatformGame.Credit.cs:154-179; contracts/platform/PlatformGame/PlatformGame.Dice.cs:30-42; contracts/platform/PlatformGame/PlatformGame.Dice.cs:72-118; contracts/platform/PlatformGame/PlatformGame.Countdown.cs:29-44; contracts/platform/PlatformGame/PlatformGame.Oracle.cs:95-153; contracts/platform/PlatformGame/PlatformGame.Internal.cs:137-152

DESIGN IMPLICATION: The kernel already owns fee intake, session state, settle, reward payout, and credit — the full lifecycle. Oracle-failure refund and pull-payment credit are kernel-level guarantees a tenant gets for free; the redesign should keep these as non-negotiable shared invariants.

### (2) Multi-tenancy mechanics: appId-scoped keys + admin-gated registration; config blob is dead weight

FACTS: Every app-specific key is appId-prefixed: AppKey(appId, prefix[, id|addr]) with composite variants appId+prefix+addr+id — 'storage never collides between tenants'. RegisterGame(appId ≤64 chars, gameType 1-4, appAdmin, config) is PLATFORM-admin-only, rejects duplicate appIds, marks active by default. Mutating methods must call RequireRegistered + RequireGameType (prevents calling countdown methods on a CoinFlip app). What is data-configurable per tenant TODAY: appAdmin address, per-app pause flag, and Gacha runtime content (machines, items, prices, weights created by users). What is NOT data: every economic parameter (5% dice fee, bet limits, countdown fee splits, key price curve) is a compile-time const shared by all tenants. The registration `config` blob is stored and readable via GetGameConfig but NO game module ever reads it, and the deploy script passes `[]byte{}`.

EVIDENCE: contracts/platform/PlatformGame/PlatformGame.Storage.cs:31-56; contracts/platform/PlatformGame/PlatformGame.Registry.cs:27-64; contracts/platform/PlatformGame/PlatformGame.Internal.cs:66-114; contracts/platform/PlatformGame/PlatformGame.Registry.cs:130-136; deploy/scripts/deploy_platform_game.go:299; contracts/platform/PlatformGame/PlatformGame.Gacha.Admin.cs:15-61; contracts/platform/PlatformGame/PlatformGame.Dice.cs:30-35

DESIGN IMPLICATION: The tenancy grammar (appId key prefix + RequireRegistered + RequireGameType) is solid and reusable verbatim. The unfinished part is the config blob: a v2 kernel must make economics per-tenant DATA (validated ranges) instead of consts, or new tenants can never differ without an upgrade.

### (3a) What still requires a per-game contract: 9 kernel-generation clones whose entire diff is constants

FACTS: 9 skill-game contracts (MiniAppAimMaster, ColorClash, CurveArrow, FlappyDash, Game2048, MergeKingdom, PetPotion, SnakeBounty, Sudoku — all v3.0.0, 811-818 lines each, identical 4-partial structure) each deploy separately yet contain no game logic: gameplay runs in the TEE; the contract does StartGame (consume entry credit→pool, reserve fixed reward, deadline, per-UTC-day cap, one-active-game rule), FinalizeGame (one kernel call: submitMiniAppRequestFromIntegration(player, APP_ID, 'game.session', 'session.finalize', sealedOpLog)), onMiniAppResult (assert caller==Oracle(), parse fixed 79-byte RESULT CODEC 0x02||commitment(32)||answerHash(32)||elapsedMs(u64BE)||undos(u8)||score(u32BE)||difficulty(u8), payout = reward*(100-30*undos)/100 if score>=target), permissionless ExpireGame, pull-payment Withdraw. Measured diff AimMaster vs ColorClash: Play.cs = 0 lines; Oracle.cs = 1 event-arg name; main file = manifest description + 3 per-difficulty lookup tables (LimitMs, MinSolveMs, TargetScore). What forces the separate deployment: per-game APP_ID const, per-difficulty entry/reward consts, an isolated pool/credit ledger with solvency invariant (heldGAS == pool + Σcredits; reserved ≤ pool), a hardcoded Owner, its own oracle binding, and its own Solved leaderboard event. The design doc's recipe for game #N: 'a contract cloning the economics + kernel consumer'.

EVIDENCE: contracts/MiniAppAimMaster/MiniAppAimMaster.cs:52-104; contracts/MiniAppAimMaster/MiniAppAimMaster.Play.cs:19-83; contracts/MiniAppAimMaster/MiniAppAimMaster.Oracle.cs:19-42; contracts/MiniAppAimMaster/MiniAppAimMaster.Oracle.cs:145-170; contracts/MiniAppAimMaster/MiniAppAimMaster.cs:40-43; claudedocs/game-miniapps-design.md:40-42

DESIGN IMPLICATION: These 9 are the strongest zero-deploy candidates in the fleet: their entire per-game surface is already a descriptor (entries, rewards, time limits, target score, daily cap). A multi-tenant 'RewardGame' module on the PlatformGame grammar — registerGame(appId, descriptor) with per-appId pool/credit sub-ledgers — would collapse 9 deployments (~7,300 lines) into rows of data.

### (3b) The bespoke-crypto older generation still deployed alongside

FACTS: MiniAppSheepSolitaire (v2.0.0, 843 lines) and MiniAppJumpRush use the SUPERSEDED per-game trust model: an owner-registered TEE signer verified on-chain via CryptoLib.VerifyWithECDsa(secp256r1) in permissionless BindPuzzle + SettleVerified, with domain-separated digests ('miniapp-game-bind-v1'/'miniapp-game-settle-v1') pinning contract hash + network magic. The v3 kernel generation deleted per-game SetTeeSigner and moved the verification root into the kernel's shared RUNTIME_VERIFIER (checked inside FulfillRequest before the callback); game contracts assert only caller==Oracle(). The design doc marks the bespoke text as 'history'.

EVIDENCE: contracts/MiniAppSheepSolitaire/MiniAppSheepSolitaire.Settle.cs:12-14; contracts/MiniAppSheepSolitaire/MiniAppSheepSolitaire.Settle.cs:25-45; contracts/MiniAppJumpRush/MiniAppJumpRush.Settle.cs:11-27; contracts/MiniAppAimMaster/MiniAppAimMaster.cs:29-31; claudedocs/game-miniapps-design.md:1-4

DESIGN IMPLICATION: Trust-root centralization is the enabler of thin/zero contracts: once the kernel verifies, tenant crypto disappears. SheepSolitaire/JumpRush are the migration debt demonstrating the before-state; the v2 library design should plan their absorption.

### (4) Governance/admin model

FACTS: PlatformGame: two-tier. Platform admin (set to deployer in _deploy) rotates only via 24h timelock (ProposeAdmin → ExecuteAdminChange after TIMELOCK_DELAY_MS=86,400,000ms, CancelAdminChange; events AdminTimelockProposed/AdminChanged — audit fix corrected a former seconds-vs-ms bug giving an 86-second timelock). Platform admin only: RegisterGame, SetOracle, SetAbstractAccount, SetContractPaused (global kill switch overriding per-app state), Update (upgrade, emits ContractUpgraded with nef/manifest hashes). App admin OR platform admin: per-app SetPaused. Contract permissions are an explicit allowlist (audit fix H-11 removed wildcard *:*). Countdown platform fees withdraw to an app-admin-designated address per tenant. The 9 thin game contracts by contrast use a single hardcoded Owner (InitialValue NR3E4D8N...) gating SetPaused/SetDailyCap/SetOracle/WithdrawPool (free-pool-only, never reserved funds)/Update — no timelock, no per-tenant split.

EVIDENCE: contracts/platform/PlatformGame/PlatformGame.Admin.cs:18-22; contracts/platform/PlatformGame/PlatformGame.Admin.cs:100-105; contracts/platform/PlatformGame/PlatformGame.Admin.cs:117-151; contracts/platform/PlatformGame/PlatformGame.cs:90-97; contracts/platform/PlatformGame/PlatformGame.cs:50-59; contracts/MiniAppAimMaster/MiniAppAimMaster.cs:66-67; contracts/MiniAppAimMaster/MiniAppAimMaster.cs:206-259; contracts/platform/PlatformGame/PlatformGame.Countdown.cs:232

DESIGN IMPLICATION: PlatformGame's timelocked-platform-admin + per-app-admin split is the governance grammar to generalize; the thin contracts' single hardcoded Owner is the weaker model that multi-tenancy would retire.

### (5) How apps reach the kernel: framework facade + manifest hash binding

FACTS: Apps bind a primary contract per network in neo-manifest.json 'contracts' ({'neo-n3-testnet': '0xed26...'} for aim-master), mirrored in platform/host-app/public/miniapp-definitions/*.json. framework/game-facade.ts exposes app.game: .rules(config) — data-config factory for stakes/penalty/grace constants (game-rules.ts, 'the only real per-game content is the CONSTANTS'); .reward(config) — full lifecycle surface whose default on-chain ops are startGame/finalizeGame/expireGame/withdraw + reads freePool/creditOf/activeGameOf/getGame/statsOf (overridable per app via config.methods), TEE lanes openSession/recordOp/replayOps hitting the generic /api/morpheus/session/{start,step} host via framework/logic/tee-session.ts (SESSION_BASE='/api/morpheus/session', replacing bespoke per-game clients), finalize sealing the op-log then broadcasting, and .runner() composing the standard start/resume/record/finalize state machine. Guards are uniform: guest-mode assert + S11 'invoke:primary' manifest permission on every broadcast lane, 'oracle:request' on TEE lanes. app.funds (funds.ts) is the payment-carrying lane (payAndCall/prepayAndInvoke) with FrameworkPrepaidActionError marking recoverable 'deposit landed, consume failed' states. Registration on PlatformGame is performed by Go deploy scripts, not by apps: deploy_platform_game.go pgRegisterApps loops env-driven appId:gameType specs; deploy_game_testnet.go registers 'miniapp-last-survivor' as type 1.

EVIDENCE: apps/aim-master/neo-manifest.json:6; framework/game-facade.ts:145-300; framework/gamefi/reward-game-sdk.ts:244-253; framework/game-rules.ts:1-30; framework/logic/tee-session.ts:34; framework/funds.ts:41-76; deploy/scripts/deploy_platform_game.go:284-315; deploy/scripts/deploy_game_testnet.go:30-31

DESIGN IMPLICATION: The client side is ALREADY generic: reward-game-sdk's method map defaults match the thin-contract ABI, so a multi-tenant kernel only needs to keep (or map) that ABI plus an appId argument. The facade's config-over-code pattern is the client mirror of the descriptor grammar.

### Deployment reality check: PlatformGame consolidation is built but the live wager apps still bind standalone contracts

FACTS: The four wager apps' manifests bind four DIFFERENT hashes (last-survivor mainnet 0x8e1e432e... which hardened_hashes_2026-06-05.json attributes to standalone MiniAppLastSurvivor; dice-game 0xef1fac02..., fogplay 0x611c3d97..., gasbox 0x30e9d4a4...), not one shared PlatformGame hash. Standalone legacy contracts remain in-tree (MiniAppCoinFlip/V2, MiniAppDiceGame/V2, MiniAppGasBox/V2, MiniAppLastSurvivor). Deploy scripts for PlatformGame registration exist and are validation-hardened, but no repo file records a live PlatformGame hash bound by any app manifest. I could not verify chain state (read-only survey), so the measured claim is: file evidence shows manifests pointing at per-app standalone deployments.

EVIDENCE: apps/last-survivor/neo-manifest.json:9; deploy/hardened_hashes_2026-06-05.json:6; platform/host-app/public/miniapp-definitions/dice-game.json:22; contracts/README.md:311; deploy/scripts/register_platform_game_app.go:80

DESIGN IMPLICATION: The kernel pattern is proven in code and tests but not yet the fleet's live binding for the wager quartet — the v2 design should treat manifest cutover (and credit/state migration) as first-class work, not an afterthought.

### Extracted design grammar for generalizing to other domains

FACTS: The grammar across both embodiments: (1) REGISTRATION — admin-gated registerGame(appId, type, appAdmin, config) creating a tenant row; worker-side twin is the hash-pinned engine whitelist keyed by (appId, engineHash). (2) DATA-CONFIG — per-game constants live in a descriptor (worker abi.js 'descriptor holding every per-game constant'; client FrameworkGameRuleConfig/RewardGameConfig), though on-chain economics are still consts (the gap). (3) SCOPED STORAGE — every tenant key = appId + prefix (+id/addr), with RequireRegistered/RequireGameType/per-app pause/per-app reentrancy-lock guards. (4) SHARED LIFECYCLE — memo-routed deposit credit ('appId:...'), consume-into-pool + reserve-reward start, oracle/TEE settle with a FIXED result codec, refund-on-oracle-failure, pull-payment withdraw, permissionless expiry. (5) CENTRAL TRUST ROOT — kernel-side RUNTIME_VERIFIER so tenants carry zero crypto. (6) TWO-TIER GOVERNANCE — timelocked platform admin + per-app admin. Sister platform contracts (PlatformSocial with Envelope/Trust/Vault modules + its own Credit.cs and Storage.cs; PlatformDeFi with Lending/FlashLoan/Capsule + Credit.cs/Storage.cs; PlatformAnchor) repeat the same partial-file shape, showing the grammar already spread to social and DeFi domains.

EVIDENCE: contracts/platform/PlatformGame/PlatformGame.Registry.cs:27; claudedocs/game-miniapps-design.md:9-13; contracts/platform/PlatformGame/PlatformGame.Storage.cs:10-23; contracts/platform/PlatformGame/PlatformGame.Credit.cs:144-179; contracts/MiniAppAimMaster/MiniAppAimMaster.cs:29-31; contracts/platform/PlatformSocial/PlatformSocial.Storage.cs:1; contracts/platform/PlatformDeFi/PlatformDeFi.Storage.cs:1

DESIGN IMPLICATION: A v2 platform-contract library can standardize these six moves as a shared base (registration registry, consumed descriptor schema, AppKey storage kit, credit/pool/reserve ledger, oracle callback router, two-tier governance) so a new miniapp in ANY domain registers a descriptor instead of deploying — with the 9 skill games as the first migration cohort and PlatformSocial/DeFi as proof the grammar transfers.

### LANE SUMMARY
The 'generic oracle kernel' is two complementary systems. (A) PlatformGameContract (contracts/platform/PlatformGame, 24 partials, 3,488 lines) is a live multi-tenant on-chain kernel: platform-admin-gated RegisterGame(appId, gameType 1-4, appAdmin, config) creates tenants; every storage key is appId-prefixed (AppKey helpers); the kernel owns the full lifecycle — memo-routed prepaid credit ('appId:...'), bet/round/play state, VRF request/callback routing with refund-on-oracle-failure, pull-payment payouts, per-app reentrancy locks — under two-tier governance (24h-timelocked platform admin + per-app admin pause). Its weakness: the registration config blob is never consumed; all economics are compile-time consts, and the four wager apps' manifests still bind standalone legacy contracts, not PlatformGame. (B) The Morpheus TEE session kernel (external repo) makes skill games pure data off-chain (hash-pinned engine + descriptor, no appId branches), verified by a shared RUNTIME_VERIFIER — so its 9 consumer contracts (AimMaster, ColorClash, CurveArrow, FlappyDash, Game2048, MergeKingdom, PetPotion, SnakeBounty, Sudoku; ~815 lines each) contain zero crypto and zero game logic, and differ from each other ONLY in constants (measured: Play.cs diff = 0 lines). Two older contracts (SheepSolitaire, JumpRush) still carry the superseded bespoke secp256r1 verification. Apps reach games through framework/game-facade.ts app.game.reward() whose default method map (startGame/finalizeGame/expireGame/withdraw + 5 reads) matches the thin-contract ABI, TEE lanes on generic /api/morpheus/session/* endpoints, uniform guest+S11 permission guards, and manifest per-network contract-hash binding. Design grammar to generalize for zero-deploy: registration registry + consumed per-tenant descriptor (make economics data, closing PlatformGame's gap) + appId-scoped storage + shared credit/pool/reserve lifecycle with kernel-held trust root + two-tier governance; the 9 identical skill-game contracts are the first cohort that would collapse into descriptor rows.


## Lane 3

### Fleet inventory baseline

FACTS: 39 deployable contract projects: 34 MiniApp* standalone contracts + 5 platform contracts (MiniAppFactory, PlatformAnchor, PlatformGame, PlatformSocial, PlatformDeFi), plus 2 test fixtures and 1 shared-source pack (MiniApp.DevPack). 241 .cs files under contracts/. Compiled artifacts land as per-contract .nef/.manifest.json in contracts/build/. All projects share only Directory.Build.props (net10.0 + Neo.SmartContract.Framework 3.9.1 pin).

EVIDENCE: contracts/Directory.Build.props:1; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:1; contracts/build/

DESIGN IMPLICATION: The census below measures per-contract copies of ten mechanics; a platform-contract layer can absorb most of them either multi-tenant (deploy nothing) or via the existing compile-time DevPack (thin shim).

### (1) OnNEP17Payment memo-dispatch receivers

FACTS: 38 definitions, all with the identical signature `public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)`; 36 in deployable contracts, 2 in fixtures. ~30 use `(string)data` memo dispatch with per-app constants of the form "miniapp-<app>:<action>" (fund/entry/stake/draw/bury...). 4 variants: (a) 2-memo fund/entry TEE-game template x9; (b) HouseGameBase deposit path (shared source, 2 adopters); (c) bespoke memo sets (SelfLoan 3 memos, TimeCapsule parameterized "fish:" prefix); (d) platform tenant routing "appId:..." + gacha object-array consumption (PlatformGame). A source-parsing convention test enforces the credit-only rule (no outbound transfers inside the callback) for 20+ named money contracts.

EVIDENCE: contracts/MiniAppGame2048/MiniAppGame2048.cs:179; contracts/MiniAppCredits/MiniAppCredits.cs:128; contracts/MiniAppSelfLoan/MiniAppSelfLoan.cs:106; contracts/MiniAppTimeCapsule/MiniAppTimeCapsule.cs:108; contracts/platform/PlatformGame/PlatformGame.Credit.cs:154; contracts/platform/PlatformSocial/PlatformSocial.Credit.cs:18; contracts/platform/PlatformDeFi/PlatformDeFi.Credit.cs:22; contracts/platform/PlatformAnchor/PlatformAnchor.Staking.cs:127; contracts/MiniApp.DevPack/MiniAppMoneyBase.cs:47; contracts/__tests__/OnNep17PaymentConventionTests.cs:28; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Funds.cs:16; contracts/MiniAppCoinFlipV2/MiniAppCoinFlipV2.cs:86; contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.Lifecycle.cs:20; contracts/MiniAppGasBoxV2/MiniAppGasBoxV2.cs:159; contracts/MiniAppMultisig/MiniAppMultisig.cs:120

DESIGN IMPLICATION: The validate+memo-route+credit skeleton is one function repeated ~36 times with only memo strings and event names varying; PlatformGame already proves the appId-routing multi-tenant form. A platform PaymentHub or a base-class CreditGasDeposit (already written in MoneyBase) covers nearly all of it.

### (2) Credit ledgers

FACTS: 23 contracts define `byte[] PREFIX_CREDIT`; ~20 expose a CreditOf read; a byte-identical private `AddCredit(ctx, player, amount)` helper sits at the same line (146) in 8 template-game Play.cs files (+JumpRush:139, SheepSolitaire:156, PlatformAnchor variant). TotalCreditLiability (solvency counter) exists in only 2 contracts: MiniAppCredits and MiniAppTarotVrf. 4 divergent ledger schemes: template PREFIX_CREDIT, MoneyBase PREFIX_MONEY_CREDIT 0x60 (adopted by 0 deployed contracts, fixture-only), CompactBase DIRECT_GAS/ASSET credit 0x70/0x71, and platform per-appId AppKey ledgers. 36 files reference CreditKey().

EVIDENCE: contracts/MiniAppGame2048/MiniAppGame2048.Play.cs:146; contracts/MiniAppFlappyDash/MiniAppFlappyDash.Play.cs:146; contracts/MiniAppColorClash/MiniAppColorClash.Play.cs:146; contracts/MiniAppPetPotion/MiniAppPetPotion.Play.cs:146; contracts/MiniAppMergeKingdom/MiniAppMergeKingdom.Play.cs:146; contracts/MiniAppSudoku/MiniAppSudoku.Play.cs:146; contracts/MiniAppSnakeBounty/MiniAppSnakeBounty.Play.cs:146; contracts/MiniAppJumpRush/MiniAppJumpRush.Play.cs:139; contracts/MiniAppSheepSolitaire/MiniAppSheepSolitaire.Play.cs:156; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Storage.cs:51; contracts/MiniApp.DevPack/MiniAppMoneyBase.cs:40; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:234; contracts/platform/PlatformAnchor/PlatformAnchor.Internal.cs:204; contracts/MiniAppCredits/MiniAppCredits.cs:128; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Reads.cs:61

DESIGN IMPLICATION: Credit ledger is the single most duplicated mechanic (23 defs, 25 'Credited' + 27 'CreditWithdrawn' events). Only 2 contracts track total liability — a shared ledger should make the solvency counter mandatory, not optional. MoneyBase already encodes the proven rules but has zero deployed adopters; the gap is adoption, not design.

### (3) Reentrancy locks

FACTS: 3 independent implementations, divergent policy: (a) TarotVrf global contract busy-flag: AcquireLock/ReleaseLock/ValidateNotBusy on PREFIX_LOCK, also folded into its ValidateAdmin; (b) PlatformGame per-appId AcquireReentrancyLock/ReleaseReentrancyLock used across Countdown/Gacha/Dice/CoinFlip flows (~14 call sites); (c) PlatformDeFi per-borrower flash-loan reentrancy key set before external call, deleted after exact-repayment assert. The other ~30 standalone miniapps have NO explicit lock — they rely on the credit-only OnNEP17Payment convention + assert-checked transfers (CEI).

EVIDENCE: contracts/MiniAppTarotVrf/MiniAppTarotVrf.Storage.cs:136; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Storage.cs:142; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Storage.cs:144; contracts/platform/PlatformGame/PlatformGame.Internal.cs:137; contracts/platform/PlatformGame/PlatformGame.Countdown.cs:172; contracts/platform/PlatformGame/PlatformGame.Gacha.Expiry.cs:29; contracts/platform/PlatformDeFi/PlatformDeFi.FlashLoan.cs:116; contracts/platform/PlatformDeFi/PlatformDeFi.FlashLoan.cs:172

DESIGN IMPLICATION: Three lock granularities (contract-wide, per-tenant, per-account-per-operation) all reduce to 'assert key absent, put, delete'. A shared base can offer all three as helpers; the fleet's real defense today is the convention test, which a shared receiver would make structural.

### (4) Admin/witness gates

FACTS: Two idioms. (a) Hardcoded-owner: `Assert(Runtime.CheckWitness(Owner))` inline at 73 sites; Owner is an [InitialValue] address constant in 21 files with only 2 distinct addresses fleet-wide (NR3E4D8NUXh... and NTT7sxdJmf...). (b) Storage-admin: ValidateAdmin() defined 8x with byte-identical bodies (read Admin(), assert valid, assert witness) — the only drift is MiniAppFactory's `admin != null` vs `!= UInt160.Zero` elsewhere. 274 total Runtime.CheckWitness call sites.

EVIDENCE: contracts/MiniApp.DevPack/MiniAppCompactBase.cs:79; contracts/platform/MiniAppFactory/MiniAppFactory.cs:116; contracts/platform/PlatformAnchor/PlatformAnchor.Internal.cs:13; contracts/platform/PlatformGame/PlatformGame.Internal.cs:17; contracts/platform/PlatformSocial/PlatformSocial.Admin.cs:37; contracts/platform/PlatformDeFi/PlatformDeFi.Admin.cs:36; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Storage.cs:147; contracts/MiniAppGame2048/MiniAppGame2048.cs:209

DESIGN IMPLICATION: ValidateAdmin is already convergent; the split to close is hardcoded [InitialValue] Owner (21 contracts, un-rotatable without upgrade) vs storage-based Admin (rotatable). The DevPack constraint is real: [InitialValue] must live on the concrete class, so a shared base must standardize on storage-admin.

### (5) Settlement grace windows / deadlines

FACTS: `SETTLE_GRACE_MS = 600_000` (10 min) duplicated verbatim in 11 game contracts (9 with the identical comment). Divergent-policy constants elsewhere: CLAIM_GRACE 90d (QuadraticFunding, mirrored as CLAIM_GRACE_MS in MilestoneEscrow), APPROVAL_GRACE_PERIOD 30d (MilestoneEscrow), GRACE_PERIOD_MS 7d (PlatformSocial), LIQUIDATION_GRACE_MS 1h (PlatformDeFi). Deadline+grace assert pattern `Runtime.Time <= g.Deadline + SETTLE_GRACE_MS, "settlement window closed"` repeats across the game family.

EVIDENCE: contracts/MiniAppGame2048/MiniAppGame2048.cs:62; contracts/MiniAppFlappyDash/MiniAppFlappyDash.cs:62; contracts/MiniAppAimMaster/MiniAppAimMaster.cs:62; contracts/MiniAppColorClash/MiniAppColorClash.cs:62; contracts/MiniAppMergeKingdom/MiniAppMergeKingdom.cs:62; contracts/MiniAppPetPotion/MiniAppPetPotion.cs:62; contracts/MiniAppSnakeBounty/MiniAppSnakeBounty.cs:62; contracts/MiniAppSudoku/MiniAppSudoku.cs:62; contracts/MiniAppSheepSolitaire/MiniAppSheepSolitaire.cs:61; contracts/MiniAppCurveArrow/MiniAppCurveArrow.cs:65; contracts/MiniAppJumpRush/MiniAppJumpRush.cs:32; contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.cs:67; contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.GracePeriod.cs:22; contracts/platform/PlatformSocial/PlatformSocial.cs:138; contracts/platform/PlatformDeFi/PlatformDeFi.cs:187

DESIGN IMPLICATION: The 600_000ms settle grace is a game-kernel parameter, identical across the family — it belongs in the shared game engine as one constant (or per-app config). The non-game grace periods are genuinely different products and should stay per-contract policy.

### (6) Upgrade methods

FACTS: 36 files call ContractManagement.Update. Three auth variants: (a) instant owner-witness update — the majority (~30), with two cosmetic arg spellings `new object[0]` vs `null`; (b) self-managed 24h timelock with sha256(nef+manifest) pin: ScheduleUpdate/Update pairs in JumpRush and SheepSolitaire (PREFIX_UPGRADE_TIME/PREFIX_UPGRADE_HASH); (c) PlatformGame 24h admin timelock (TIMELOCK_DELAY_MS = 86400000). CompactBase owns one shared instant-update copy inherited by its 4 adopters. CoinFlipV2/DiceGameV2 explicitly document 'no timelock' as accepted risk.

EVIDENCE: contracts/MiniApp.DevPack/MiniAppCompactBase.cs:152; contracts/MiniAppJumpRush/MiniAppJumpRush.cs:223; contracts/MiniAppJumpRush/MiniAppJumpRush.cs:232; contracts/MiniAppSheepSolitaire/MiniAppSheepSolitaire.cs:296; contracts/platform/PlatformGame/PlatformGame.Admin.cs:123; contracts/platform/PlatformGame/PlatformGame.cs:97; contracts/MiniAppCoinFlipV2/MiniAppCoinFlipV2.Reads.cs:26; contracts/MiniAppGame2048/MiniAppGame2048.cs:258; contracts/MiniAppCredits/MiniAppCredits.Admin.cs:85; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Admin.cs:114; contracts/platform/PlatformDeFi/PlatformDeFi.Admin.cs:83; contracts/platform/PlatformSocial/PlatformSocial.Admin.cs:98; contracts/platform/MiniAppFactory/MiniAppFactory.cs:113; contracts/MiniAppDailyCheckin/MiniAppDailyCheckin.Owner.cs:64; contracts/MiniAppBurnLeague/MiniAppBurnLeague.Admin.cs:32

DESIGN IMPLICATION: Upgrade is 36 copies of a 4-line method with an inconsistent timelock story (2 miniapps + 1 platform have it, 33 don't). A shared base should ship the timelocked variant as default; per-deployment the method must still exist in each NEF (no inheritance on-chain), so it's DevPack material, not platform-contract material.

### (7) Pause / kill switches

FACTS: 19 SetPaused definitions; 56 files touch pause state; ZERO kill/destroy methods fleet-wide. Variants: owner-witness bool flag writing PREFIX_PAUSED (template games), ValidateAdmin-gated (CompactBase:143, platform contracts), per-tenant pause in multi-tenant contracts (3 PREFIX_APP_PAUSED defs), plus CompactBase reserves a PauseRegistry hash slot PREFIX_PAUSE_REGISTRY 0x05.

EVIDENCE: contracts/MiniAppGame2048/MiniAppGame2048.cs:208; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:143; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:25; contracts/MiniAppCredits/MiniAppCredits.Admin.cs:49; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Admin.cs:34; contracts/MiniAppDailyCheckin/MiniAppDailyCheckin.Owner.cs:28; contracts/platform/PlatformGame/PlatformGame.Registry.cs:85; contracts/platform/PlatformAnchor/PlatformAnchor.cs:122; contracts/platform/PlatformSocial/PlatformSocial.Admin.cs:89; contracts/platform/PlatformDeFi/PlatformDeFi.Admin.cs:74

DESIGN IMPLICATION: Pause is a 6-line mechanic copied 19x with a 'PausedChanged' event copied 13x. A platform PauseRegistry (one contract the fleet consults, slot already reserved in CompactBase) would let one switch pause many apps; per-contract flags remain needed only for contracts that keep their own funds.

### (8) Fee accounting / revenue buckets

FACTS: No shared abstraction; heterogeneous per-contract buckets: PREFIX_REVENUE at byte 0x15 in Tarot but 0x14 in TarotVrf; PREFIX_FEE 0x15 in DailyCheckin; BPS constants scattered with different names and rates: FEE_BPS 50 (SelfLoan), CAPSULE_FEE_BPS 100 / FLASH_FEE_BPS 9 / LENDING_FEE_BPS 50 (PlatformDeFi), CD_PLATFORM_FEE_BPS 500 (PlatformGame), TRUST_PLATFORM_FEE_BPS 100 / VAULT_PLATFORM_FEE_BPS 200 (PlatformSocial). Withdraw surface: 143 public Withdraw* methods total — 28 Withdraw, 13 WithdrawPool, 5 WithdrawRevenue, 4 WithdrawBankroll, 3 WithdrawGasCredit, 3 WithdrawCredit, plus 8 one-off names.

EVIDENCE: contracts/MiniAppTarot/MiniAppTarot.cs:82; contracts/MiniAppTarotVrf/MiniAppTarotVrf.cs:14; contracts/MiniAppDailyCheckin/MiniAppDailyCheckin.cs:118; contracts/MiniAppSelfLoan/MiniAppSelfLoan.cs:106; contracts/platform/PlatformDeFi/PlatformDeFi.cs:187; contracts/platform/PlatformGame/PlatformGame.Countdown.cs:36; contracts/platform/PlatformSocial/PlatformSocial.cs:138; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Callback.cs:1; contracts/MiniAppTarotVrf/MiniAppTarotVrf.Funds.cs:16

DESIGN IMPLICATION: Fee RATES are legitimately per-product, but the bucket mechanics (accrue, read, owner-withdraw with event) repeat. A shared revenue-bucket helper plus standardized Withdraw naming would collapse ~50 of the 143 withdraw methods into 3 canonical shapes.

### (9) Storage-prefix conventions

FACTS: 495 `byte[] PREFIX_*` definitions, all following the single-byte-array prefix convention; zero string-literal storage keys found. Byte values collide freely across contracts (0x15 = FEE in DailyCheckin, = REVENUE in Tarot, = PLAYER_CNT in HouseGameBase) — harmless since Neo storage is per-contract, but there is no fleet registry. Top duplicated names: PREFIX_CREDIT x23, PREFIX_PAUSED x19, PREFIX_STATS x14, PREFIX_POOL x14, PREFIX_GAME_ID x13, PREFIX_GAME x13, PREFIX_ORACLE x12, PREFIX_TOP_WON/TOP_ADDR x11 each, PREFIX_OWNER x10. Two namespacing schemes: flat prefix+suffix key builders (CompactBase Key() overloads) vs multi-tenant AppKey(appId, prefix, ...) re-implemented in 4 platform contracts (PlatformAnchor 3 overloads, PlatformSocial 3+, PlatformDeFi 5 overloads, PlatformGame).

EVIDENCE: contracts/MiniApp.DevPack/MiniAppCompactBase.cs:20; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:57; contracts/MiniApp.DevPack/MiniAppHouseGameBase.cs:55; contracts/platform/PlatformAnchor/PlatformAnchor.Internal.cs:240; contracts/platform/PlatformSocial/PlatformSocial.Storage.cs:34; contracts/platform/PlatformDeFi/PlatformDeFi.Storage.cs:14; contracts/MiniAppDailyCheckin/MiniAppDailyCheckin.cs:118; contracts/MiniAppTarot/MiniAppTarot.cs:82; contracts/MiniAppJumpRush/MiniAppJumpRush.cs:88

DESIGN IMPLICATION: Convention is already uniform (byte prefixes + typed key builders); what's missing is one canonical prefix map and one AppKey implementation. A shared library should reserve a prefix range for base-owned slots (CompactBase already does: 0x01-0x06, 0x70-0x71) so app code cannot collide with kernel code — the one place collisions WOULD matter.

### (10) Event naming conventions

FACTS: 376 `public static event` fields, uniformly C#-named On<Name> with [DisplayName("<PascalCase past-tense/noun>")] ABI names (434 DisplayName attributes total; the extra ~58 are NEP-11 lowercase method aliases like totalSupply/ownerOf in the token contracts). Most duplicated ABI event names: CreditWithdrawn x27, Credited x25, Solved x20, PoolFunded x13, PausedChanged x13, PoolWithdrawn x12, GameStarted x11, GameExpired x11, DailyCapChanged x11, OracleChanged x10, RevenueWithdrawn x5, ContractUpgraded x4, BankrollFunded/Withdrawn x4 each. DevPack documents the hard constraint: the nccs DevPack requires events to be declared on the concrete contract class, not on a base.

EVIDENCE: contracts/MiniAppGame2048/MiniAppGame2048.cs:170; contracts/MiniApp.DevPack/MiniAppHouseGameBase.cs:29; contracts/MiniApp.DevPack/MiniAppMoneyBase.cs:29

DESIGN IMPLICATION: Naming is already de-facto standardized (the same 10 names cover ~150 of 376 events). But events CANNOT move into a shared base (compiler constraint), so the shared layer must ship them as a documented event vocabulary + per-contract boilerplate a template emits — or the platform multi-tenant contract emits them once with an appId field, which PlatformGame already does.

### Shared C# library TODAY (the direct answer)

FACTS: YES, one exists: contracts/MiniApp.DevPack (875 lines, 5 files) — MiniAppCompactBase.cs (abstract MiniAppBase: admin/pause/gateway/oracle slots, key builders, ValidateAdmin/ValidateAddress, instant Update, direct GAS/asset credit), MiniAppHouseGameBase.cs+Settle.cs (full commit/reveal house-game engine with multi-block beacon and bankroll solvency invariant), MiniAppMoneyBase.cs (credit-ledger + safe-transfer primitives), MiniAppContractUsings.cs. Consumption is SOURCE-LEVEL: csproj `<Compile Include="../MiniApp.DevPack/X.cs">` (not ProjectReference, not NuGet) so nccs compiles base+concrete into one NEF. Adoption: CompactBase → 4 contracts (EventTicketPass, MilestoneEscrow, QuadraticFunding, SoulboundCertificate); HouseGameBase → 2 (CoinFlipV2, DiceGameV2); MoneyBase → 0 deployed (fixture-only). Net: 6 of 39 deployable contracts (~15%) use shared source; 33 are hand-rolled. MoneyBase's own doc-comment names the fleet it was written to replace (RedEnvelope, LastSurvivor, TimeCapsule, Tarot, TipJar, BreakupPact...) — none migrated.

EVIDENCE: contracts/MiniApp.DevPack/MiniAppCompactBase.cs:18; contracts/MiniApp.DevPack/MiniAppHouseGameBase.cs:9; contracts/MiniApp.DevPack/MiniAppMoneyBase.cs:10; contracts/MiniAppCoinFlipV2/MiniAppCoinFlipV2.csproj:3; contracts/MiniAppEventTicketPass/MiniAppEventTicketPass.csproj:3; contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.csproj:3; contracts/MiniAppSoulboundCertificate/MiniAppSoulboundCertificate.csproj:3; contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.csproj:3; contracts/MiniAppDiceGameV2/MiniAppDiceGameV2.csproj:3

DESIGN IMPLICATION: The mechanism (abstract base via Compile Include) is proven and already carries audit-hardened logic. The v2 library is therefore an extension+adoption problem, not an invention problem. Known constraints to design around: events and [InitialValue] constants must live on the concrete class; each deployment still carries the full code (no on-chain linking on Neo N3).

### TEE-game template family — the largest verbatim-copy block

FACTS: 9 reward games (game-2048, aim-master, color-clash, curve-arrow, flappy-dash, merge-kingdom, pet-potion, snake-bounty, sudoku) share a 4-file, ~814-line template (main + Play + Reads + Oracle partials). Measured diff distance vs game-2048: main 34-67 lines, Play 2-10 lines, Reads 5-11 lines, Oracle 2-4 lines — i.e. >90% identical, varying only in app name, memo strings, and minor rules. Sheep-solitaire diverged further (188/50/30 changed lines); jump-rush is a single-file cousin that adds an upgrade timelock and TEE pubkey slot. That is roughly 9 x ~750 duplicated lines ≈ 6,800 lines of copy-maintained contract code.

EVIDENCE: contracts/MiniAppGame2048/MiniAppGame2048.cs:1; contracts/MiniAppGame2048/MiniAppGame2048.Play.cs:1; contracts/MiniAppFlappyDash/MiniAppFlappyDash.Play.cs:146; contracts/MiniAppSheepSolitaire/MiniAppSheepSolitaire.cs:61; contracts/MiniAppJumpRush/MiniAppJumpRush.cs:96

DESIGN IMPLICATION: This family is the strongest zero-deploy candidate: PlatformGame already implements the multi-tenant equivalent (appId registry, per-app pause, credit routing, reentrancy locks, timelocked upgrade). A generic 'TEE reward game' product inside PlatformGame — or at minimum a MiniAppRewardGameBase in DevPack — replaces ~6,800 duplicated lines with per-app data (memos, caps, deadline params).

### What CAN be shared vs what must stay per-deployment (Neo N3 constraints)

FACTS: Neo N3 has no deployed-code inheritance or dynamic linking: every contract is a self-contained NEF, so code sharing is compile-time only (abstract bases/partials via Compile Include — the working DevPack pattern; a NuGet source package would be equivalent). Must remain per-deployment/per-concrete-class: the contract hash identity, storage contents, event declarations, [InitialValue] constants, memo strings, and the public ABI. The alternative that removes deployment entirely is the multi-tenant platform contract (one deployment, AppKey(appId,...) storage) — already live in 4 contracts: PlatformGame (games+gacha+countdown, per-app locks, 24h timelock), PlatformSocial (trust/vault, 7d grace), PlatformDeFi (capsule/flash-loan/lending/gas-liquidity), PlatformAnchor (staking).

EVIDENCE: contracts/MiniApp.DevPack/MiniAppMoneyBase.cs:29; contracts/MiniApp.DevPack/MiniAppHouseGameBase.cs:30; contracts/platform/PlatformGame/PlatformGame.cs:56; contracts/platform/PlatformDeFi/PlatformDeFi.Storage.cs:14; contracts/platform/PlatformSocial/PlatformSocial.Storage.cs:34; contracts/platform/PlatformAnchor/PlatformAnchor.Internal.cs:240; contracts/Directory.Build.props:8

DESIGN IMPLICATION: Two-lane target architecture falls out of the census: (lane A) miniapps with no bespoke on-chain logic bind an appId on an existing Platform* contract and deploy NOTHING; (lane B) miniapps needing bespoke logic deploy a thin concrete class over DevPack bases (events + Owner + memos + rules only). Every one of the 10 censused mechanics already has a shared-source or platform-contract home; the census shows adoption (6/39) is the bottleneck.

### LANE SUMMARY
Cross-contract duplication census of 39 deployable Neo N3 contracts (34 miniapp + 5 platform, 241 .cs files). All ten mechanics are heavily duplicated with high byte-similarity: 38 OnNEP17Payment receivers with one signature and a governed credit-only memo-dispatch idiom (~30 use "(string)data" memos, convention-enforced by a source-parsing test); 23 PREFIX_CREDIT ledgers with a byte-identical AddCredit helper at the same line in 8 files but total-liability tracking in only 2 contracts; 3 divergent reentrancy-lock implementations (TarotVrf global, PlatformGame per-app, PlatformDeFi per-borrower) while ~30 miniapps rely on convention alone; admin gating split between 73 inline CheckWitness(Owner) sites over 21 hardcoded [InitialValue] owners (2 distinct addresses) and 8 byte-identical ValidateAdmin() helpers; SETTLE_GRACE_MS=600000 copied verbatim into 11 games; 36 ContractManagement.Update methods, only 3 contracts with timelocks; 19 SetPaused copies and zero kill switches; ad-hoc fee buckets (143 Withdraw* methods, inconsistent PREFIX_FEE/REVENUE bytes); a uniform 495-definition byte-prefix storage convention with AppKey multi-tenant namespacing re-implemented in 4 platform contracts; and a de-facto standard event vocabulary (CreditWithdrawn x27, Credited x25, PausedChanged x13) that compiler constraints force onto each concrete class. A shared source library ALREADY EXISTS — contracts/MiniApp.DevPack (875 lines: MiniAppBase, MiniAppHouseGameBase, MiniAppMoneyBase) consumed via csproj Compile Include (Neo N3 permits no on-chain code sharing) — but only 6/39 contracts (~15%) adopt it and MoneyBase has zero deployed adopters. The single largest copy block is the 9-game TEE reward template (~814 lines each, >90% identical, ≈6,800 duplicated lines), whose multi-tenant replacement pattern already runs in PlatformGame. Conclusion: the zero-deploy/thin-shim goal needs adoption and extension of existing mechanisms (Platform* appId tenancy for lane A, DevPack bases for lane B), not new invention.


## Lane 4

### CROSS-CUTTING: the generalization pattern already exists — 5 platform contracts vs 34 single-app contracts

FACTS: contracts/ holds 34 single-app MiniApp* contract projects plus 5 platform contracts: MiniAppFactory, PlatformAnchor, PlatformDeFi, PlatformGame, PlatformSocial. Three of the five are explicit multi-tenant consolidations of former per-app contracts: PlatformDeFi 'consolidating SelfLoan, FlashLoan, and CompoundCapsule', PlatformSocial 'RedEnvelope, HeritageTrust, UnbreakableVault', PlatformGame 'Countdown (LastSurvivor), CoinFlip (FogPlay), Gacha (GASBox), and Dice'. All use the same tenancy mechanism: appId registered with a type enum, storage namespaced via AppKey(appId, PREFIX_*), per-app admin + pause, shared prepaid GAS/NEO credit ledger (PREFIX_DIRECT_GAS_CREDIT), and a platform-admin timelock. Apps bind them by declaring the platform module in neo-manifest.json (e.g. "platform": "PlatformAnchor" in trustanchor/profitanchor/custom-anchor manifests).

EVIDENCE: contracts/platform/PlatformDeFi/PlatformDeFi.cs:43-48; contracts/platform/PlatformSocial/PlatformSocial.cs:41-53; contracts/platform/PlatformGame/PlatformGame.cs:22-44; apps/trustanchor/neo-manifest.json:36; apps/custom-anchor/src/manifest.ts:34

DESIGN IMPLICATION: The zero-deploy goal is not greenfield: the proven migration recipe is port-to-appId-namespaced-module. New scenario families should be added as modules on these hulls (or sibling hulls) rather than as new per-app contracts; the per-contract copy-pasted credit/withdraw/pause boilerplate is the first thing a v2 kernel should unify.

### Payments / transfers

FACTS: Plain transfers use native NEO/GAS directly with no custom contract (neo-treasury: 'has no custom deployed contract. It invokes the native NEO or GAS token contract directly'). The platform-specific instance is MiniAppCredits: on-chain GAS→credit purchase at fixed 50 credits/GAS, off-chain DB spends, batched on-chain settlement checkpoints, and a user Exit that burns last-settled credits back to GAS even while paused. Every money contract also re-implements the same deposit-with-memo → prepaid-credit → consume/withdraw convention (e.g. selfloan:collateral/fund/repay memos). private-transfer is explicitly 'a testnet-only encrypted-intent workspace… not a payment rail' with no contract.

EVIDENCE: apps/neo-treasury/README.md:3-11; contracts/MiniAppCredits/MiniAppCredits.cs:13-50; contracts/MiniAppSelfLoan/MiniAppSelfLoan.cs:51-53,106-148; apps/private-transfer/README.md:3-4

DESIGN IMPLICATION: One-shot payments need no platform contract. The generalizable asset is the prepaid-credit ledger: a single shared credit kernel (per-app memo namespace, asset param GAS|NEO, pull-withdraw, event schema) would replace ~30 copies. Cheap: parameterize an existing, already-quadruplicated pattern (it exists inside PlatformGame/Social/DeFi/Anchor already).

### Escrow / conditional release

FACTS: MiniAppMilestoneEscrow is the strongest instance: CreateEscrow(creator, beneficiary, asset NEO|GAS, totalAmount, milestoneAmounts[2..N]) funded from prepaid credit; creator ApproveMilestone → beneficiary ClaimMilestone (direct transfer); CancelEscrow refunds remainder but is blocked while any approved-unclaimed milestone exists (audit fix C-3); has a GracePeriod partial and gateway-or-witness auth. Single-deployment but data-level multi-user (any creator can open escrows). Release condition is exactly one shape: manual creator approval per milestone.

EVIDENCE: contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.Methods.cs:16-97; contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.Methods.cs:102-127; contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.Methods.cs:192-201; contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.GracePeriod.cs:1

DESIGN IMPLICATION: Cheap-to-medium generalization: add appId tenancy + a release-condition axis (creator-approve | deadline auto-release | third-party arbiter | M-of-N approvers) and an asset axis (arbitrary NEP-17, today hard-coded NEO|GAS). Dispute/arbitration is the only genuinely new design surface.

### Vesting / streaming

FACTS: MiniAppNeoPay is a real deployed streaming contract (mainnet 12 streams, testnet 2126): createStream/8, claimStream/2, cancelStream/2, linear release over 1–365 days, GAS or NEO, creator cancel reclaims unreleased funds — but its SOURCE IS NOT IN THIS REPO (only live-verified ABI docs). In-repo time-lock relatives: MiniAppTimeCapsule (bury GAS until unlock time, reveal returns it) and PlatformDeFi.Capsule (multi-tenant time-lock with compound yield from a segregated yield reserve).

EVIDENCE: apps/neo-pay/NETWORK_STATUS.md:5-16; apps/neo-pay/README.md:1-9; contracts/MiniAppTimeCapsule/MiniAppTimeCapsule.cs:13-42; contracts/platform/PlatformDeFi/PlatformDeFi.cs:37-40,62,97

DESIGN IMPLICATION: Coverage exists but the flagship instance is un-forkable from this repo. A platform vesting module means re-implementing NeoPay semantics inside a platform hull (medium), then adding schedule shapes (cliff/linear/step), multiple beneficiaries, and cancel-policy parameters. TimeCapsule/Capsule give the storage and CEI patterns to copy.

### Staking / delegation

FACTS: PlatformAnchor is already a multi-tenant NEO staking + council-vote-delegation service: modes TRUST(1)/PROFIT(2), per-app AA agent accounts that hold staked NEO and cast NEO.vote for candidates, accumulator-pattern GAS rewards (Stake/Withdraw/HarvestRewards/FundRewards/ClaimRewards), and a permissionless RegisterCustomAnchorApp behind a 1 GAS anti-spam fee (audit fix M-11) — proven by the custom-anchor app. MiniAppGovMerc adds a second staking flavor (stake NEO, per-epoch GAS auction revenue split pro-rata with a JIT-staking guard).

EVIDENCE: contracts/platform/PlatformAnchor/PlatformAnchor.cs:23-44; contracts/platform/PlatformAnchor/PlatformAnchor.Staking.cs:13-98; apps/custom-anchor/src/manifest.ts:34; contracts/MiniAppGovMerc/MiniAppGovMerc.cs:13-45

DESIGN IMPLICATION: This family is essentially done and is the platform's best proof that permissionless tenancy works. Remaining axes are cheap: reward-source options (external funder vs GAS claim), optional lock/cooldown periods, and non-council delegation targets.

### Swap / AMM

FACTS: NO on-chain instance. neo-swap: 'There is currently no deployed swap router in neo-manifest.json… contracts is intentionally empty'; the app is a Morpheus price-feed quote desk with a dormant settlement adapter behind five explicit enablement gates (reviewed router implementing swapTokenInForTokenOut, manifest registration, event integration tests, testnet verification, re-review). neo-convert also has an empty binding. A QUANTUMSWAP hash exists only in the legacy registry with no source.

EVIDENCE: apps/neo-swap/README.md:5,27-38; apps/neo-convert/neo-manifest.json (empty contracts); deploy/config/contract-hashes.json:50

DESIGN IMPLICATION: Deep gap: an AMM/router (pool math, LP shares, slippage floors, fee model) is a new design, not a parameterization of anything existing. The neo-swap README already specifies the required interface (swapTokenInForTokenOut + SwapExecuted event), which constrains a future platform router's ABI.

### Lending / collateral loans

FACTS: Two implementations at different maturity. MiniAppSelfLoan (single-app): NEO collateral, GAS debt, owner-set price (no live oracle), LTV tiers 20/30/40 bps-coded, 0.5% origination fee, no liquidation, no interest. PlatformDeFi.Lending (multi-tenant): loans with liquidation + price-drop grace window (FixV audit), liquidation surplus return, abandonment sweep, segregated per-product GAS pools (audit A10: lending liquidity vs capsule reserve vs flashloan LP principal), per-app keeper/oracle-updated NEO price (audit H-3), and an optional ProfitAnchor vote-sync hook. PlatformDeFi.FlashLoan covers flash loans (requestLoan with callback + exact fee repayment; the flashloan app binds testnet hash 0xde8e595d matching the FLASHLOAN registry entry).

EVIDENCE: contracts/MiniAppSelfLoan/MiniAppSelfLoan.cs:13-53,182-221; contracts/platform/PlatformDeFi/PlatformDeFi.cs:16-29,84-98,118-120; contracts/platform/PlatformDeFi/PlatformDeFi.FlashLoan.cs:1; apps/flashloan/README.md:21-39

DESIGN IMPLICATION: PlatformDeFi.Lending IS the generalized service already. Remaining axes are medium: live oracle price integration (today keeper-set per app), interest accrual, multiple collateral assets (NEO-only today), partial liquidation. SelfLoan the miniapp could migrate onto it (its docstring notes it deliberately mirrors the app's simpler no-liquidation model).

### Token issuance (NEP-17 factory)

FACTS: MiniAppFactory is a deployed template registry + factory explicitly backing three factory miniapps: 'Asset Factory (NEP-17 tokens), NFT Factory (NEP-11 collections), MiniApp Factory (miniapp instances)' — asset-factory, nft-factory and miniapp-factory all bind the same testnet hash 0x03a7c8fc…. Templates are admin-preloaded; deployment is per-user with caller-supplied NEF+manifest and an on-chain digest check digest==Base64(Sha256(nef||manifest||initParams)) (audit A11 fixed the fixed-NEF hash-collision brick). Deploys either record metadata or perform a real ContractManagement.Deploy.

EVIDENCE: contracts/platform/MiniAppFactory/MiniAppFactory.cs:23-47; contracts/platform/MiniAppFactory/MiniAppFactory.Deploy.cs:11-70; apps/asset-factory/neo-manifest.json (0x03a7c8fc…)

DESIGN IMPLICATION: Covered and multi-tenant by construction. Cheap next axes: template registration governance, a queryable deployed-asset registry with metadata, and post-deploy management surfaces (mint/burn/pause admin) baked into the standard templates.

### NFT issuance (NEP-11) + marketplace

FACTS: Issuance is covered twice: MiniAppFactory NEP-11 collection templates, plus two concrete NEP-11 contracts — MiniAppEventTicketPass (tickets with QR check-in, operator authorization, transfer/resale, [SupportedStandards(NepStandard.Nep11)]) and MiniAppSoulboundCertificate (non-transferable certificates with templates, max supply, revocation). MARKETPLACE: no instance anywhere in contracts/ — no listing, auction, offer, or royalty logic; DUTCHAUCTION exists only as a legacy hash with no source.

EVIDENCE: contracts/MiniAppEventTicketPass/MiniAppEventTicketPass.cs:12-55; contracts/MiniAppSoulboundCertificate/MiniAppSoulboundCertificate.cs:12-46; contracts/platform/MiniAppFactory/MiniAppFactory.cs:25-28; deploy/config/contract-hashes.json:20

DESIGN IMPLICATION: Issuance: covered. Marketplace: deep gap — fixed-price listing + escrowed settlement is a moderate new module (PlatformGame already has the onNEP11Payment permission pattern for NFT custody), but auctions/offers/royalties are net-new design.

### Governance / voting / council

FACTS: MiniAppCouncilGovernance is deployed and live (testnet: 13 proposals, 12 votes; ABI: createProposal, vote, revokeProposal, finalizeProposal, executeProposal + policy-change execution; committee 21, quorum 30%, threshold 50%) but its SOURCE IS NOT IN THIS REPO; a known deployed quirk treats duration args as milliseconds despite *Seconds field names. In-repo adjacent: PlatformAnchor delegates NEO votes to council candidates per app; MiniAppGovMerc runs a governance-revenue auction.

EVIDENCE: apps/council-governance/NETWORK_STATUS.md:5-16; apps/council-governance/README.md:22-28; contracts/platform/PlatformAnchor/PlatformAnchor.cs:23-29

DESIGN IMPLICATION: An instance exists but is app-specific, un-forkable from this repo, and council-key-gated. A generalized tenant voting module (arbitrary electorate definition: address-list | NEO-weighted | SBT-gated; proposal payload = text | contract-call; configurable quorum/threshold/duration) is a medium re-implementation, with the deployed ABI as a compatibility reference.

### Lottery / raffle / randomness (VRF)

FACTS: Three randomness tiers exist. (1) VRF-grade: MiniAppTarotVrf — Morpheus 'vrf_random' request/callback with prepaid reading fee, separate sponsored oracle-fee reserve, unbiased 3-of-78 card derivation, failure refunds, permissionless expiry, MAX_PENDING cap, and timelocked address/update changes. (2) Oracle-RNG kernel: PlatformGame routes CoinFlip/Gacha/Dice through the Morpheus oracle callback per app. (3) Beacon-grade: CoinFlipV2/DiceGameV2 commit + fixed 3-block native beacon (fogplay binds MiniAppCoinFlipV2), and PlatformSocial envelope draws are explicitly documented 'grinding-resistant but not grinding-proof… NOT VRF-grade'. No generic raffle/lottery product exists (LOTTERY/NOLOSSLOTTERY are legacy hashes without source).

EVIDENCE: contracts/MiniAppTarotVrf/MiniAppTarotVrf.cs:27-56; contracts/platform/PlatformGame/PlatformGame.cs:30-44; apps/fogplay/README.md:36-44; contracts/platform/PlatformSocial/PlatformSocial.Envelope.cs:99-104; deploy/config/contract-hashes.json:36,43

DESIGN IMPLICATION: The primitive is covered; the product is not. Cheap-medium: lift TarotVrf's request/refund/expiry/fee-sponsorship pattern into a multi-tenant 'randomness lane' module, then a raffle (ticket sales + VRF winner draw) is a thin product on top. The three-tier randomness taxonomy should be an explicit parameter apps declare.

### Attestation / DID / credentials

FACTS: MiniAppSoulboundCertificate covers verifiable credentials as non-transferable NEP-11: issuer authorization, certificate templates with max supply, categories, revocation. DID proper is EXTERNAL: neodid-passport resolves against NeoDIDRegistry 0xb81f31ea… which exists on mainnet only, has no testnet deployment, and its source is not in this repo; the app explicitly does not issue credentials or verify signatures.

EVIDENCE: contracts/MiniAppSoulboundCertificate/MiniAppSoulboundCertificate.cs:12-46; apps/neodid-passport/README.md:3,24-27

DESIGN IMPLICATION: SBT→generic attestation service is cheap: parameterize issuer sets, claim schema hash, expiry, and appId tenancy on the existing contract. A platform DID registry is a medium standalone build (or formal adoption of the external NeoDIDRegistry, which the platform does not control today).

### Timestamping / notary

FACTS: NO contract. timestamp-proof anchors a SHA-256 digest via a 0-GAS self-transfer carrying 'timestamp-proof:<digest>' in the tx data field, verified later from the application log; local journal is browser-only. Digest-storing relatives exist as deployed-but-source-absent contracts (graveyard 0xb55aa635 stores memory digests with fees; memorial-shrine offerings).

EVIDENCE: apps/timestamp-proof/README.md:3-17,24-31; apps/graveyard/README.md:8-13; apps/memorial-shrine/README.md:52-55

DESIGN IMPLICATION: Cheapest module in the whole matrix: a per-app notary registry (appId + digest → block time + submitter, duplicate policy, optional fee) is one storage map and one event, and would upgrade timestamp-proof from tx-archaeology to a first-class queryable proof.

### Multisig / account abstraction

FACTS: MiniAppMultisig implements M-of-N custody deliberately WITHOUT native CheckMultisig (dApi wallets cannot produce raw secp256r1 partial witnesses): vaults of 2–16 signers + threshold custody NEO/GAS in-contract; spends are proposed requests, each signer approves via normal CheckWitness invoke, contract executes at threshold with CEI ordering. The AA stack (AA Core account registration, SocialRecoveryVerifier guardians/threshold/review-window, session keys, relay) is deployed and bound by 6 apps (aa-*, recovery-guardian) but its contract sources are NOT in this repo; recovery-guardian's first-time setup is even feature-flagged off pending an external verifier upgrade.

EVIDENCE: contracts/MiniAppMultisig/MiniAppMultisig.cs:13-56,143-150; apps/recovery-guardian/README.md:9-11,33-37; apps/aa-account-lab/README.md:1-22

DESIGN IMPLICATION: Custody multisig: covered, generalization cheap (arbitrary NEP-17 assets, signer rotation, request expiry, per-request timelock, appId tenancy). AA: functionally covered for apps but an external dependency the platform repo cannot evolve — a strategic decision point for the platform-contracts goal.

### Subscription / recurring

FACTS: Partial coverage only, via MiniAppNeoPay streams (sender pre-funds the full amount; release unlocks on schedule; beneficiary pulls) — the README markets it for 'payroll, subscriptions, memberships, treasury allowances'. There is NO pull-based mandate (merchant-initiated recurring charge) anywhere; grep for subscription/recurring across contracts/ hits only unrelated game tests. Neo N3 has no token allowance primitive, so mandates require custody-based designs.

EVIDENCE: apps/neo-pay/README.md:7-9; apps/neo-pay/NETWORK_STATUS.md:11-16; contracts/ grep 'subscription|recurring' → only __tests__/MiniAppDiceGameV2Tests.cs, __tests__/MiniAppCoinFlipV2Tests.cs

DESIGN IMPLICATION: Pre-funded streams cover fixed-obligation subscriptions cheaply once a platform vesting/stream module exists (same module, different labeling). True variable-amount pull subscriptions are a deep design (custodial allowance vault + merchant charge caps + revocation) — recommend explicitly de-scoping or staging it.

### Tipping / social payments

FACTS: MiniAppTipJar: developers self-register once per wallet (sequential devId), tippers prepay GAS ('miniapp-devtipping:tip' memo) then tip(tipper, devId, amount, anonymous) moves credit to the developer's claimable balance with lifetime totals and Tipped events; developer withdrawTips, tipper reclaims unused credit; MIN_TIP 0.001 GAS. Deployed same hash on both networks; single-tenant contract but any developer can register.

EVIDENCE: contracts/MiniAppTipJar/MiniAppTipJar.cs:13-56; apps/dev-tipping/README.md:3,33-40

DESIGN IMPLICATION: Cheap generalization: appId tenancy + recipient-entity abstraction (any registered payee, not 'developer') + optional platform fee bps yields a universal social-payments module; the registry/claimable/anonymous-flag mechanics carry over unchanged.

### Red envelope / gifting

FACTS: Fully generalized already — the exemplar migration. MiniAppRedEnvelope (deployed both nets, v1.1 live-verified 2026-07-10) was ported into PlatformSocial.Envelope: multi-tenant per appId, claim-time bounded random split seeded by consensus beacon (audit M-4 removed pre-computed plaintext packets), duplicate-claim guard, expiry refund, best-luck tracking; plus a RangeGasPool variant (min/max per claim, max claims). gas-lucky-pool targets the RangePool ABI but keeps writes disabled because its deployed binding still points at the MiniAppRedEnvelope ABI.

EVIDENCE: contracts/platform/PlatformSocial/PlatformSocial.Envelope.cs:24-131; contracts/platform/PlatformSocial/PlatformSocial.Envelope.RangePool.cs:1; apps/red-envelope/README.md:52; apps/gas-lucky-pool/PRODUCTION_STATUS.md:20-21; apps/gas-lucky-pool/src/main.tsx:19

DESIGN IMPLICATION: Done as a service; remaining cheap axes: opt-in VRF-grade draw (vs beacon), NEP-17 asset parameter, claim gating (allowlist/SBT). The stalled gas-lucky-pool binding shows the real bottleneck is deployment/rebinding operations, not contract code.

### Crowdfunding / quadratic funding

FACTS: MiniAppQuadraticFunding: rounds with creator, asset NEO|GAS, matching pool, start/end times; third-party matching sponsors tracked per-funder so cancellation refunds pro-rata (audit NEW-H-8); projects + contributions with QF matching allocation and permissionless post-cancel refund routing. Single deployment, but any creator can run rounds. Plain all-or-nothing crowdfunding does not exist as a separate product.

EVIDENCE: contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.Methods.cs:13-76; contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.Methods.cs:78-120; contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.Projects.cs:1

DESIGN IMPLICATION: Cheap: plain crowdfunding is a degenerate case (matching formula = none; add an all-or-nothing threshold refund policy). Medium: sybil-resistance hook for QF (today per-address only — an SBT/DID gate would compose with the attestation family) and arbitrary NEP-17 assets.

### Insurance / prediction markets

FACTS: No prediction-market or insurance contract in the repo; PREDICTIONMARKET exists only as a legacy hash (deploy/config/contract-hashes.json:47) with no source. Nearest primitives: MiniAppBreakupPact — two-party symmetric commitment bond (matched GAS stakes, breaker forfeits both to partner, honored pact refunds both, pull-payment resolution); price data via the Morpheus feed and a deployed PriceFeed console contract (oracle-price-console bindings 0x03013f49/0x9bea75cf, source not in contracts/); PlatformDeFi carries a per-app keeper price for liquidation.

EVIDENCE: contracts/MiniAppBreakupPact/MiniAppBreakupPact.cs:12-38; deploy/config/contract-hashes.json:47; apps/oracle-price-console/neo-manifest.json (PriceFeed bindings)

DESIGN IMPLICATION: Deep gap: markets need creation, outcome resolution (oracle or designated reporter), share/payout math, and dispute windows — net-new design. BreakupPact generalizes cheaply into a small 'mutual commitment bond' module (N parties, matched stakes, referee option), which is honest partial coverage but is not a prediction market.

### Treasury management

FACTS: No custody/treasury contract. neo-treasury is a read-only founder-address watchlist plus native-token transfers from the connected wallet ('It does not control the watched wallets and it is not a treasury multisig contract'). In-repo treasury-adjacent primitives: MiniAppMultisig custody vaults, PlatformDeFi fee accumulators/sweeps and segregated product pools, PlatformAnchor reward reserves.

EVIDENCE: apps/neo-treasury/README.md:3-11; contracts/MiniAppMultisig/MiniAppMultisig.cs:13-42; contracts/platform/PlatformDeFi/PlatformDeFi.cs:84-98

DESIGN IMPLICATION: Medium, mostly compositional: a treasury product = multisig vault + spend policies (budgets/roles/limits) + streams (vesting module) + reporting events. Building it as a composition over the multisig and stream modules avoids a new monolith.

### Name service

FACTS: Covered by binding the official Neo NameService contract directly (0x50ac1c37690cc2cfc594472833cf57505d5f46de on both networks in neo-ns manifest); the app does search/register/renew/transfer/TXT-target against the native NNS ABI with readback confirmation. No platform contract exists or is referenced as needed.

EVIDENCE: apps/neo-ns/neo-manifest.json; apps/neo-ns/README.md:3-27

DESIGN IMPLICATION: No generalization needed — the ecosystem contract IS the service. Only build a platform namespace registry if the platform wants its own sub-namespace semantics (deep, and probably unjustified).

### CROSS-CUTTING: honesty ledger — deployed contracts whose sources are NOT in this repo

FACTS: At least these live bindings cannot be evolved from this repo: MiniAppNeoPay (payments/vesting), MiniAppCouncilGovernance (governance), MiniAppGasSponsor v2 (gas sponsorship pools: createPool/claimSponsorship), the AA stack (AA Core, SocialRecoveryVerifier, session-key/relay contracts behind 6 apps), NeoDIDRegistry (mainnet-only), graveyard/memorial-shrine digest contracts, and the entire 67-entry legacy registry in deploy/config/contract-hashes.json (LOTTERY, NOLOSSLOTTERY, PREDICTIONMARKET, DUTCHAUCTION, HERITAGETRUST, COMPOUNDCAPSULE…) — the last two families DO have in-repo successors inside PlatformSocial/PlatformDeFi.

EVIDENCE: apps/neo-pay/NETWORK_STATUS.md:5-8; apps/council-governance/NETWORK_STATUS.md:5-8; apps/gas-sponsor/README.md:3,17-20; apps/recovery-guardian/README.md:33-37; deploy/config/contract-hashes.json:12,20,34,36,43,47

DESIGN IMPLICATION: Any 'platform provides everything' architecture must classify these as (a) re-implement in platform hulls (NeoPay, CouncilGovernance are the highest-value), (b) formally adopt as external dependencies with pinned ABIs (native NNS, NeoDIDRegistry, AA stack), or (c) retire (legacy registry). Counting them as 'covered' without a plan would inflate the census.

### LANE SUMMARY
Mainstream-scenario coverage matrix across contracts/ + app bindings (77 miniapps, 34 single-app contracts + 5 platform contracts). ALREADY GENERALIZED (multi-tenant, appId-namespaced): staking/delegation (PlatformAnchor, incl. permissionless custom tenants), lending+flash-loan+time-lock-capsule (PlatformDeFi with liquidation/grace/segregated pools), red-envelope/gifting (PlatformSocial.Envelope+RangePool), dead-man-switch inheritance (PlatformSocial.Trust), hash-bounty vault (PlatformSocial.Vault), game/RNG kernel (PlatformGame: Countdown/CoinFlip/Gacha/Dice), and NEP-17/NEP-11/miniapp factory (MiniAppFactory with per-user digest-verified deploys). STRONG SINGLE-APP INSTANCES, CHEAP TO PARAMETERIZE (add tenancy + 1-2 axes): escrow (MilestoneEscrow — needs release-condition axis), quadratic funding (QF ⊃ plain crowdfunding), custody multisig (Multisig — needs asset/rotation axes), tipping (TipJar — needs payee abstraction), VRF lane (TarotVrf request/refund/expiry pattern), SBT attestation (SoulboundCertificate — needs schema/issuer axes), commitment bonds (BreakupPact), NEP-11 ticketing (EventTicketPass), credits (Credits). COVERED ONLY BY DEPLOYED CONTRACTS WHOSE SOURCE IS OUTSIDE THIS REPO (re-implement or formally adopt): vesting/streaming + prepaid subscriptions (MiniAppNeoPay), governance proposals (MiniAppCouncilGovernance), gas sponsorship (MiniAppGasSponsor), AA/social recovery (AA Core + verifiers), DID registry (NeoDIDRegistry, mainnet-only). COVERED BY ECOSYSTEM-NATIVE CONTRACTS (no build needed): plain payments (native NEO/GAS), name service (official NNS). TRUE GAPS (deep new design): swap/AMM router (neo-swap explicitly gated off), NFT marketplace (no listing/auction/royalty code), prediction markets/insurance (legacy hash only), pull-based subscriptions, treasury product (compositional over multisig+streams), and a notary/digest registry — the last being the cheapest win in the matrix (one storage map + event). The proven migration pattern (port single-app contract → appId module on a platform hull, as done 3x) plus unifying the quadruplicated prepaid-credit ledger are the foundation moves for the zero-deploy/thin-shim goal.


## Lane 5

### PlatformDeFi — ABI and tenancy

FACTS: Multi-tenant DeFi engine consolidating 3 products keyed by appId string: Lending(1), FlashLoan(2), Capsule(3). ~40 public methods across 12 partials. Admin surface: _deploy captures deployer as admin; SetAdmin/SetPaused/Update are platform-admin witness-gated; RegisterProduct(appId, productType, appAdmin, config) is PLATFORM-ADMIN ONLY (no self-service registration); SetAppPaused accepts platform admin OR per-app appAdmin (ValidateAppAuthority). Product methods all take appId as first arg: CreateLoan/RepayLoan/AddCollateral/AbandonLoan/LiquidateLoan/SetNeoGasPrice, RequestFlashLoan/FlashDeposit/FlashWithdraw, CreateCapsule/UnlockCapsule/EarlyWithdraw/CompoundYield, plus per-app GAS liquidity funding lanes (LendingDeposit, FundCapsuleYieldReserve) and per-app fee sweeps (WithdrawLendingFees/WithdrawCapsuleFees/WithdrawFlashLoanFees gated by ValidateAppAuthority). Storage isolation via AppKey(appId, PREFIX) concatenation; global prefixes 0x01-0x0F reserved for platform, per-product ranges 0x20-0x4F. Price oracle is per-app push (SetNeoGasPrice, ValidateAppAuthority, ±20% deviation cap, 1h min interval, 1h liquidation grace).

EVIDENCE: contracts/platform/PlatformDeFi/PlatformDeFi.cs:42-57 (multi-tenant doc + ContractPermission); contracts/platform/PlatformDeFi/PlatformDeFi.Admin.cs:94-147 (RegisterProduct, ValidateAdmin-only); contracts/platform/PlatformDeFi/PlatformDeFi.Admin.cs:48-55 (ValidateAppAuthority: platform OR app admin); contracts/platform/PlatformDeFi/PlatformDeFi.Storage.cs:14-31 (AppKey builders); contracts/platform/PlatformDeFi/PlatformDeFi.FeeSweep.cs:43-59 (per-app fee sweep, ValidateAppAuthority); contracts/platform/PlatformDeFi/PlatformDeFi.Lending.Liquidation.cs:54 (SetNeoGasPrice)

DESIGN IMPLICATION: The per-app-isolated storage + appAdmin + per-app fee accumulator pattern is already the right shape for zero-deploy tenancy; the blockers are admin-only registration and zero live consumers.

### PlatformDeFi credit ledger is payer-global, NOT appId-scoped

FACTS: OnNEP17Payment credits NEO/GAS to PREFIX_NEO_CREDIT/PREFIX_GAS_CREDIT keyed by sender address only — comment says 'appId resolved at consume-time'. WithdrawNeoCredit/WithdrawGasCredit are witness-gated to the payer with no appId. So prepaid deposits are fungible across all DeFi tenants on the contract.

EVIDENCE: contracts/platform/PlatformDeFi/PlatformDeFi.Credit.cs:28-49 (credit keyed by from only); contracts/platform/PlatformDeFi/PlatformDeFi.Credit.cs:100-147 (withdrawals, no appId)

DESIGN IMPLICATION: Three different credit-tenancy models coexist (see PlatformGame finding); a v2 library should pick one deliberately — per-(appId,payer) gives clean fee/refund attribution, payer-global gives cross-app UX.

### PlatformSocial — ABI and tenancy

FACTS: Multi-tenant social engine, appTypes: Envelope(1), Trust(2), Vault(3). ~35 public methods: RegisterApp(appId, appType, appAdmin, config) is PLATFORM-ADMIN ONLY (PlatformSocial.Admin.cs:109); SetAppPaused platform-or-app admin. Product methods all take appId: CreateEnvelope/ClaimEnvelope/RefundExpiredEnvelope, CreateRangeGasPool/ClaimRangeGasPool/FundRangeGasPool/RefundRangeGasPool, CreateTrust/Heartbeat/ExecuteTrust/CancelTrust/AddGuardian, CreateVault/CommitAttempt/RevealAttempt/IncreaseBounty/RefundExpiredVault. Funding model: user first transfers GAS/NEO (OnNEP17Payment credits payer-global balance, no memo/appId routing), then the create call consumes the ENTIRE credit balance (CreateEnvelope reads full balance as envelope amount). Credit ledger is payer-global (PREFIX_DIRECT_GAS_CREDIT / PREFIX_DIRECT_ASSET_CREDIT keyed by user only). NO per-app fee accumulators or fee-sweep methods exist in PlatformSocial — the only withdrawal surfaces are user credit withdrawals.

EVIDENCE: contracts/platform/PlatformSocial/PlatformSocial.Admin.cs:109-132 (RegisterApp admin-only); contracts/platform/PlatformSocial/PlatformSocial.Credit.cs:18-37,73-101 (payer-global credit, no memo); contracts/platform/PlatformSocial/PlatformSocial.Envelope.cs:24-48 (CreateEnvelope consumes whole credit balance); contracts/platform/PlatformSocial/PlatformSocial.cs:38-44 (multi-tenant doc)

DESIGN IMPLICATION: Social has tenancy for state but no fee-attribution story; a platform-services goal needs per-app fee accrual added here or accepted as free.

### PlatformGame — non-game surfaces (registry, credits, oracle, admin)

FACTS: Registry: RegisterGame(appId≤64 chars, gameType 1-4 Countdown/CoinFlip/Gacha/Dice, appAdmin, config blob) is PLATFORM-ADMIN ONLY; reads GetGameType/IsGameActive/GetGameAdmin/GetGameConfig; SetPaused is app-or-platform admin. Admin: two-step ProposeAdmin/ExecuteAdminChange (unlike DeFi/Social single-step), SetOracle, SetAbstractAccount. Credits: (appId, payer)-scoped — OnNEP17Payment REQUIRES memo format 'appId:...' and asserts the appId is registered; GetDirectGasCredit(appId, payer), WithdrawGasCredit(appId, amount) witness-gated and deliberately works while paused; internal AddDirectGasCredit used for pull-payment prize payouts. Oracle: single OnOracleResult(requestId, requestType, success, result, error) callback, ValidateOracle + requestType=='vrf_random' pinned, dispatches by stored per-request context (appId, gameType, operationId), refunds stakes on oracle failure. Fees: per-app accumulators with app-or-platform-admin sweeps (WithdrawCountdownPlatformFees(appId,to), WithdrawGachaRevenue(appId, machineId, to)).

EVIDENCE: contracts/platform/PlatformGame/PlatformGame.Registry.cs:27-64 (RegisterGame admin-only); contracts/platform/PlatformGame/PlatformGame.Credit.cs:35-51,154-179 (memo 'appId:...' routing, appId-scoped credit); contracts/platform/PlatformGame/PlatformGame.Oracle.cs:95-153 (OnOracleResult dispatch + refund); contracts/platform/PlatformGame/PlatformGame.Countdown.cs:232-250 (per-app fee sweep); contracts/platform/PlatformGame/PlatformGame.cs:65-68 (game types)

DESIGN IMPLICATION: PlatformGame is the most complete tenancy blueprint: appId-scoped credits with memo routing, per-app fees, per-request oracle context. Its memo convention ('appId:...') is the existing on-chain fee/credit attribution mechanism.

### MiniAppCredits — full ABI, custody model, deployment status

FACTS: Platform-wide credit ledger, NO appId scoping on-chain (balances keyed by user; app attribution lives only in the off-chain DB spend rows). Fixed rate 1 GAS = 50 credits (GAS_PER_CREDIT=2_000_000). Writes: OnNEP17Payment (GAS only, memo 'miniapp-credits:buy' required, mints floor credits), PostSettlement(epoch, users[], deltas[]) — settler-or-owner gated, strictly-negative deltas (settler can never mint), epochs strictly monotonic, clamp-at-zero, MAX_BATCH=500; Exit(user) burns entire settled balance back to GAS, works while paused; SetSettler/SetPaused/WithdrawGas(owner, solvency-guarded to surplus)/Update owner-gated. Reads: GetOwner, Settler, IsPaused, SettledBalanceOf, CurrentEpoch, LastSettlementAt, TotalGasCollected, TotalSettledCredits, HeldGas, ExitLiabilityGas, CreditsForGas, CreditsPerGas, GasPerCredit, MaxSettlementBatch. Status per docs/MINIAPP_CREDITS_LEDGER.md:3: 'implemented (contract + edge + migration); not yet deployed/validated'. Compiled artifacts exist (contracts/build/MiniAppCredits.nef).

EVIDENCE: contracts/MiniAppCredits/MiniAppCredits.cs:12-75,128-148; contracts/MiniAppCredits/MiniAppCredits.Settlement.cs:47-137; contracts/MiniAppCredits/MiniAppCredits.Reads.cs:13-87; contracts/MiniAppCredits/MiniAppCredits.Admin.cs:34-86; docs/MINIAPP_CREDITS_LEDGER.md:3

DESIGN IMPLICATION: Credits already implement the 'app deploys nothing' model end-to-end: one shared contract + DB-first per-app attribution. It is the working template for how a platform service reaches apps without per-app contracts.

### PlatformAnchor — the only shared platform contract with live app bindings, and the only permissionless registration path

FACTS: Shared TrustAnchor/ProfitAnchor NEO-staking/AA-agent-voting engine, appId-scoped (modes TRUST=1, PROFIT=2). 5 apps bind it via their manifests: trustanchor, trustanchor-admin, profitanchor, profitanchor-admin, custom-anchor all declare mainnet 0x02beeef6f65c6989a121c0a0e6b23190333edb98 / testnet 0xab079b4f9a0a2471d136392e25eb8e99898dcad0. Deployment records confirm mainnet 0x02beeef6... (updated 2026-05-10) but the testnet update record shows a DIFFERENT hash 0xeb6b3725d47d0941f36a834bdbd12f1427977604 than the manifests' 0xab079b4f... — two testnet deployments exist. RegisterAnchorApp is admin-only, but RegisterCustomAnchorApp(appId, mode, appAdmin) is PERMISSIONLESS: appAdmin witness + a 1 GAS anti-spam fee consumed from the caller's prepaid GAS credit (audit fix M-11) — the ONLY self-service tenancy onboarding in any platform contract. Staking surface: Stake/Withdraw/HarvestRewards/FundRewards/ClaimRewards all appId-scoped; credits payer-global keyed (user, asset).

EVIDENCE: contracts/platform/PlatformAnchor/PlatformAnchor.cs:141-158 (RegisterCustomAnchorApp permissionless + fee); contracts/platform/PlatformAnchor/PlatformAnchor.cs:40-45 (ANCHOR_CUSTOM_APP_REGISTRATION_FEE = 1 GAS); contracts/build/mainnet_platform_update_latest.json (existing_hash 0x02beeef6...); contracts/build/testnet_platform_update_latest.json (existing_hash 0xeb6b3725... vs manifests 0xab079b4f...); apps/trustanchor/neo-manifest.json + apps/custom-anchor/neo-manifest.json (shared hashes); apps/shared/composables/trustanchor/useTrustAnchor.ts:16,148-151,160-162 (binding pattern)

DESIGN IMPLICATION: The anchor family proves the whole zero-deploy loop works TODAY: shared hash in per-app manifests, appId passed as arg.string(APP_ID) on every call, permissionless fee-paid registration. This is the pattern to generalize.

### MiniAppFactory — existing on-chain registry, but not a runtime address registry

FACTS: Template registry + factory deployed at testnet 0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49 (bound by asset-factory, nft-factory, miniapp-factory manifests; no mainnet entry). Admin preloads templates (RegisterTemplate metadata, optional RegisterTemplateArtifact with full NEF+manifest). DeployFromTemplate records metadata-only deployments (returns UInt160.Zero); DeployArtifactFromTemplate (in MiniAppFactory.Deploy.cs) does real ContractManagement.Deploy; CreateMiniAppFromTemplate records miniapp instances keyed by packageId. It records (templateId, packageId, digest, initParams, creator, deployedHash) but does NOT provide an appId → contract-hash lookup used by any runtime resolution path.

EVIDENCE: contracts/platform/MiniAppFactory/MiniAppFactory.cs:22-54,126-283; contracts/platform/MiniAppFactory/MiniAppFactory.Reads.cs:17-97; apps/miniapp-factory/neo-manifest.json (testnet 0x03a7c8fc...)

DESIGN IMPLICATION: There is NO on-chain appId→address registry today; MiniAppFactory is the natural home if one is wanted, but current runtime resolution is entirely off-chain.

### Current consumers: PlatformDeFi/Social/Game have ~zero live app bindings — apps migrated AWAY to standalone contracts

FACTS: Measured: no app manifest points at a PlatformDeFi/PlatformSocial/PlatformGame hash. self-loan's production test asserts it 'targets the standalone deployed contract without stale PlatformDeFi routing' (0x87f94598...). gasbox's composable documents that 'the old PlatformGame gacha needed the Morpheus VRF oracle's off-chain signer to settle, which is non-operational' and now talks directly to standalone MiniAppGasBoxV2. gas-lucky-pool explicitly targets 'MiniAppRedEnvelope, not the PlatformSocial RangeGasPool ABI'. PlatformGame WAS deployed to testnet at 0x740671b10330ef6669ab8b2724437eb8d5e7a34c with miniapp-fogplay registered as gameType 2 (2026-05-11), but fogplay's manifest binds its own contract 0x611c3d97... instead. No deployment records found for PlatformDeFi/PlatformSocial in contracts/build or deploy/config.

EVIDENCE: apps/shared/test/self-loan.production.test.ts:9-17; apps/gasbox/src/composables/useGasBox.ts:4-12; apps/gas-lucky-pool/src/main.tsx:19; contracts/build/testnet_platform_game_register_latest.json (platform_game 0x740671b1..., app_id miniapp-fogplay); apps/fogplay/neo-manifest.json (0x611c3d97...)

DESIGN IMPLICATION: The multi-tenant contracts are built and audited but effectively abandoned by consumers — mostly because their oracle dependency (Morpheus VRF signer) was non-operational and per-app standalone contracts were simpler. A v2 must fix the operational dependency story, not just the contract code.

### How an app declares WHICH contract — resolution chain

FACTS: Runtime binding is a single 'primary contract' per app. Resolution order in wallet-sdk getContractAddress(): (1) the app's neo-manifest.json contracts['neo-n3-<network>'] (75 of 77 apps have a contracts block; keys observed: neo-n3-mainnet, neo-n3-testnet, neo-x-mainnet); (2) generated registry GENERATED_MINIAPP_CONTRACTS[network][appId] in apps/shared/constants/generated-miniapp-contracts.ts, produced by scripts/generate-miniapp-contract-registry.mjs FROM the neo-manifest files ('source of truth' per header comment); (3) URL ?app_id= fallback into the same registry; else throws CONTRACT_NOT_CONFIGURED. The MiniAppManifest TS type also defines an unused-in-practice ContractBinding {hash, moduleId, recipeId, mode: custom|shared|template} on manifest.contract (apps/shared/types/miniapp-manifest.ts:305-316,497). Per-call override: every framework invoke/read accepts options.scriptHash — this is how anchor apps and shared composables target the shared PlatformAnchor hash (getMiniAppContractHash(APP_ID) merged into options).

EVIDENCE: apps/shared/utils/wallet-sdk.ts:906-943 (getContractAddress resolution order); apps/shared/constants/generated-miniapp-contracts.ts:1-6 (generator provenance); apps/shared/constants/rpc.ts:218-220 (getMiniAppContractHash); apps/shared/types/miniapp-manifest.ts:305-316,497 (ContractBinding modes incl. 'shared' — declared but not consumed by the resolver); apps/shared/composables/useContractAddress.ts:23-71; apps/shared/composables/trustanchor/useTrustAnchor.ts:148-151 (scriptHash override pattern)

DESIGN IMPLICATION: Address distribution to apps is file-based (manifest JSON → generated TS), not env or on-chain. Pointing a no-contract app at a platform contract requires only a manifest contracts entry — the plumbing already carries it. The ContractBinding 'shared'/'template' modes are the designed-but-unwired hook for making this first-class.

### What contract operations the framework hardcodes

FACTS: framework/chain-surface.ts hardcodes nothing (generic operation+args, guarded by S11 'invoke:primary'). framework/funds.ts hardcodes conventions: creditOf(playerHash) default operation 'creditOf' (funds.ts:362), withdrawCredit default operation 'withdraw' + waitForEvent 'CreditWithdrawn' (funds.ts:374-385), plus the NEP-17 'transfer' 4-arg shape for the deposit lane (funds.ts:226-235). framework/game-facade.ts hardcodes 'statsOf' (game-facade.ts:350) and event 'Solved' (game-facade.ts:374). framework/gamefi/reward-game-sdk.ts defaults method names startGame/finalizeGame/expireGame/freePool/creditOf/activeGameOf/getGame (reward-game-sdk.ts:245-252, overridable per config; config also takes a scriptHash). framework/credits.ts hardcodes GAS token hash, 'transfer' with memo 'miniapp-credits:buy' targeting config.contractHash, and chain-fallback read 'settledBalanceOf' (credits.ts:63-65,641-644,806-815). These operation-name conventions are the framework's implicit ABI contract that any platform contract must satisfy.

EVIDENCE: framework/funds.ts:362-386; framework/game-facade.ts:350,374; framework/gamefi/reward-game-sdk.ts:245-252; framework/credits.ts:59-65,632-665,788-861; framework/chain-surface.ts:243-282 (generic guarded lanes)

DESIGN IMPLICATION: A platform-contract v2 that keeps method names creditOf/withdraw/statsOf/startGame/... and events CreditWithdrawn/Solved gets the entire existing framework surface (funds, game, reward runner) for free.

### Credits off-chain plumbing — the one fully-plumbed platform-service reference

FACTS: app.credits config is injected per-app via MiniAppFrameworkOptions.credits = {ledgerUrl, contractHash, network?, auth resolvers} through defineMiniApp/MiniAppRoot props (defineMiniApp.tsx:105-111, MiniAppRoot.tsx:107-112, wired at MiniAppRoot.tsx:434); absent config ⇒ app.credits.available=false with typed capability errors. 4 apps reference the lane (color-clash, dice-game, flappy-dash, self-loan main.tsx via createGameCreditsLane). Spend attribution: POST body carries app_id (lowercased deps.appId), action, amount, idempotency_key (credits.ts:709-716) — per-app attribution is DB-side only. Edge half lives in platform/edge/functions/credits-{ledger,indexer,settler} with contract hash from env CONTRACT_MINIAPP_CREDITS_HASH_<NETWORK> (platform/edge/functions/_shared/credits.ts:34-39, fails closed 503 when unset). SQL migration deploy/migrations/078_miniapp_credits.sql.

EVIDENCE: apps/shared/react/MiniAppRoot.tsx:107-112,434; framework/credits.ts:305-313,461-492,694-716; platform/edge/functions/_shared/credits.ts:34-39; deploy/migrations/078_miniapp_credits.sql

DESIGN IMPLICATION: Three address channels now exist: manifest/generated-registry (apps' primary contract), framework-options injection (credits), and env vars (edge). A v2 should collapse platform-service addresses into one host-injected config block rather than per-service ad-hoc props.

### Permission model (S11) — coarse, does not distinguish own vs platform contract

FACTS: Framework write lanes gate on manifest permissions via guardedWrite: 'invoke:primary' for ALL contract broadcasts (chain.invoke/write/invokeWithPayment/invokeMultiple, funds.*, reward start/finalize/expire/withdrawCredit), 'oracle:request' for TEE/oracle lanes, 'payments' for credits.buy only, 'aa' for AA lanes; credits.spend is deliberately ungated (DB debit). Hosts delivering no permission declaration default-allow. neo-manifest.json permissions arrays use this vocabulary ('invoke:primary', 'read:blockchain', 'aa', 'oracle'). Crucially the gate is per-lane, not per-target: an invoke with options.scriptHash pointing at a shared platform contract passes the same 'invoke:primary' check as the app's own contract — there is no 'invoke:platform-defi' style vocabulary.

EVIDENCE: framework/internal/guards.ts:44-59,85; framework/chain-surface.ts:243-268 (S11 notes); framework/credits.ts:788-792 (payments gate on buy only); apps/aa-session-key-lab/neo-manifest.json:32 (permissions vocabulary)

DESIGN IMPLICATION: Binding platform services needs either new permission names per service (manifest-declared) or acceptance that 'invoke:primary' covers cross-contract calls; today's model would let any app invoke any platform contract once it has invoke:primary.

### Gap analysis — what zero-deploy binding still needs, plumbing-wise

FACTS: Already in place: (a) address distribution — manifest contracts entry + generated registry propagate a shared hash to an app (proven by 5 anchor apps); (b) per-app storage scoping — all four Platform* contracts use AppKey(appId, prefix); (c) per-app pause + appAdmin delegation in all four; (d) per-app fee attribution in DeFi (3 fee sweeps) and Game (countdown fees, gacha revenue), attribution via appId method args (DeFi/Social/Anchor) or 'appId:' payment memos (Game). Missing/inconsistent: (1) registration is platform-admin-gated everywhere except PlatformAnchor.RegisterCustomAnchorApp (1 GAS fee) — no general self-service or deploy-time-automated onboarding; (2) no on-chain appId→address registry (registry is a generated TS file; MiniAppFactory records templates, not runtime bindings); (3) apps must hand-thread appId + scriptHash on every call (trustanchor pattern: arg.string(APP_ID) + anchorOptions() spread) — the framework has no 'platform contract surface' that auto-injects appId/scriptHash the way app.credits auto-targets its config.contractHash; (4) credit tenancy is inconsistent (Game: (appId,payer); DeFi/Social/Anchor: payer-global; Credits: payer-global chain + appId in DB); (5) manifest ContractBinding.mode 'shared'/'template' exists in types but nothing consumes it; (6) the operational oracle dependency (Morpheus VRF signer for PlatformGame resolution) is documented as non-operational, which is why consumers left.

EVIDENCE: apps/shared/composables/trustanchor/useTrustAnchor.ts:148-162 (hand-threaded appId+scriptHash); contracts/platform/PlatformAnchor/PlatformAnchor.cs:147-158; apps/shared/types/miniapp-manifest.ts:305-316 (unwired 'shared' mode); apps/shared/constants/generated-miniapp-contracts.ts:1-6; apps/gasbox/src/composables/useGasBox.ts:10-12 (oracle non-operational); framework/credits.ts:461-492 (the auto-targeting precedent)

DESIGN IMPLICATION: The shortest path to 'app deploys nothing': (1) a framework surface like app.credits per platform service (config-injected hash + appId auto-threading + the hardcoded op-name conventions), (2) manifest contracts entries pointing at the shared hash (mechanism proven), (3) a registration story — either generalize PlatformAnchor's permissionless fee-paid RegisterCustomAnchorApp or make registration a deploy-pipeline admin step, (4) unify the credit tenancy model, PlatformGame's (appId,payer)+memo being the most attribution-complete.

### LANE SUMMARY
Census of today's platform/shared contracts and the framework's contract-binding plumbing. Five platform contracts exist: PlatformDeFi (Lending/FlashLoan/Capsule, ~40 methods), PlatformSocial (Envelope/RangePool/Trust/Vault, ~35 methods), PlatformGame (Countdown/CoinFlip/Gacha/Dice plus registry/credit/oracle surfaces), PlatformAnchor (staking/AA-agent voting), and MiniAppFactory (template registry); plus MiniAppCredits (platform credit ledger, implemented but not yet deployed per its own docs). All four Platform* contracts are appId-string multi-tenant with AppKey(appId,prefix) storage isolation, platform-admin-only registration (sole exception: PlatformAnchor.RegisterCustomAnchorApp — permissionless with a 1 GAS fee), per-app appAdmin pause delegation, and per-app fee sweeps in DeFi/Game (Social has none). Credit tenancy is inconsistent: PlatformGame scopes prepaid credit by (appId,payer) with mandatory 'appId:' payment memos; DeFi/Social/Anchor keep payer-global credit; MiniAppCredits is payer-global on-chain with app attribution only in the off-chain DB. Live consumption is honest-low: only the anchor family (5 apps) binds a shared platform contract today; DeFi/Social/Game have zero manifest bindings — self-loan, gasbox and gas-lucky-pool all document deliberate migrations to standalone per-app contracts, largely because the Morpheus VRF resolution path was non-operational (PlatformGame was deployed to testnet and fogplay registered on it, then abandoned). Binding plumbing: each app has ONE 'primary contract' resolved by wallet-sdk getContractAddress() from neo-manifest.json contracts['neo-n3-<network>'] (75/77 apps) falling back to a generated TS registry built from those manifests; per-call options.scriptHash overrides let shared composables target PlatformAnchor by threading appId args by hand. The framework hardcodes op-name conventions (creditOf/withdraw/CreditWithdrawn, statsOf/Solved, startGame/finalizeGame/expireGame/freePool/activeGameOf/getGame, settledBalanceOf + 'miniapp-credits:buy'), and app.credits is the one fully-plumbed platform-service exemplar (host-injected {ledgerUrl, contractHash} config, appId-attributed DB spends, env-var addresses on the edge). No on-chain appId→address registry exists. Zero-deploy binding needs: config-injected per-service framework surfaces that auto-thread appId+scriptHash (the app.credits pattern), manifest entries pointing at shared hashes (mechanism already proven by anchors), a self-service or pipeline registration path (PlatformAnchor's fee-paid model is the existing precedent), a unified credit-tenancy decision, and a fixed oracle operations story.


## Lane 6

### Estate shape: 42 contract projects in-repo (~31.1k LOC)

FACTS: contracts/ holds 34 per-app MiniApp* contracts (20,749 LOC summed over partials), 5 platform contracts under contracts/platform (9,223 LOC: MiniAppFactory 499, PlatformAnchor 841, PlatformDeFi 2,628, PlatformGame 3,488, PlatformSocial 1,767), 1 shared base library MiniApp.DevPack (875 LOC: MiniAppMoneyBase, MiniAppHouseGameBase+Settle commit/reveal engine, MiniAppCompactBase, MiniAppMoneyBaseFixture), and 2 test fixtures (GameOracleMockFixture 57 LOC — Morpheus-kernel stand-in; TarotOracleMockFixture 233 LOC — fee-aware callback simulator). contracts/__tests__ is the C# test suite, contracts/build holds 42 .nef artifacts matching exactly the current sources. Payments are GAS-only, governance NEO-only by blueprint.

EVIDENCE: contracts/README.md:1-10; contracts/MiniApp.DevPack/MiniAppMoneyBase.cs:1-4; contracts/MiniApp.DevPack/MiniAppHouseGameBase.cs:1-3; contracts/GameOracleMockFixture/GameOracleMockFixture.cs:1-5; contracts/TarotOracleMockFixture/TarotOracleMockFixture.cs:1

DESIGN IMPLICATION: The estate is already mid-sized and single-repo; a platform-contract v2 must absorb 34 per-app deployments plus rationalize 5 platform contracts, not start from a blank slate.

### Master table A — per-app contracts WITH a live app binding (27 of 34)

FACTS: TEE skill-game reward (Morpheus kernel, 32-byte commitment + verified finalize), one contract per game: MiniAppAimMaster 815 LOC→aim-master (testnet 0xed26866f); MiniAppColorClash 815→color-clash (0xb2d0f46d); MiniAppFlappyDash 815→flappy-dash (0x39a16708); MiniAppGame2048 814→game-2048 (0x7511eefa); MiniAppMergeKingdom 815→merge-kingdom (0x3fa9eb98); MiniAppPetPotion 815→pet-potion (0xa611f038); MiniAppSnakeBounty 815→snake-bounty (0x33a85b08); MiniAppSudoku 811→sudoku (0xd4ba00fb); MiniAppJumpRush 731→jump-rush (0xd98c65af); MiniAppSheepSolitaire 843→sheep-solitaire (0x7541e136) — all testnet-only. House-banked commit/reveal betting: MiniAppCoinFlipV2 240→fogplay (0x611c3d97 both nets, live-validated 2026-07-10); MiniAppDiceGameV2 244→dice-game (0xef1fac02 both nets + a Neo X EVM twin 0xFA795F81). Others (both nets unless noted): MiniAppBreakupPact 383→breakup-contract; MiniAppBurnLeague 308→burn-league (testnet); MiniAppDailyCheckin 466→daily-checkin; MiniAppEventTicketPass 865→event-ticket-pass; MiniAppGovMerc 620→gov-merc; MiniAppLastSurvivor 336→last-survivor; MiniAppMilestoneEscrow 804→milestone-escrow; MiniAppMultisig 416→neo-multisig; MiniAppQuadraticFunding 1156→quadratic-funding; MiniAppRedEnvelope 465→red-envelope; MiniAppSelfLoan 426→self-loan; MiniAppSoulboundCertificate 813→soulbound-certificate; MiniAppTimeCapsule 384→time-capsule; MiniAppTipJar 300→dev-tipping (0x6fdcf2ff). MiniAppGasBox 396→gasbox binds a LEGACY pre-fix deployment 0x30e9d4a4 whose settle uses re-rollable Runtime.GetRandom; new paid writes are paused on it.

EVIDENCE: deploy/scripts/deploy_selected_miniapp_contracts.go:55-88; apps/shared/constants/generated-miniapp-contracts.ts:6-99; docs/reports/fogplay-v2-testnet-live-2026-07-10.md:1-14; apps/gasbox/src/deployment.ts:3-10; deploy/hardened_hashes_2026-06-05.json:1-8

DESIGN IMPLICATION: 27 apps each carry a bespoke deployment; 10 of these are near-identical ~811-843 LOC TEE skill-game clones with the same doc header — the single largest consolidation target for a shared multi-tenant reward contract.

### Master table B — per-app contract sources with NO current binding (7 of 34)

FACTS: MiniAppCoinFlip 335 LOC (v1, same-tx abort-on-loss exploit; mainnet 0x5d82339d in hardened hashes, unbound); MiniAppDiceGame 347 (v1, superseded; roster row has empty app_manifest); MiniAppGasBoxV2 596 (commit/reveal gacha fix, compiled but the gasbox app still binds the legacy V1 hash); MiniAppCredits 473 (platform credit ledger v2: on-chain buy, DB-first spend, batched postSettlement; implemented with edge functions credits-ledger/indexer/settler under platform/edge/functions but explicitly 'not yet deployed/validated against a live network'); MiniAppCurveArrow 818 (in deploy roster, but apps/curve-arrow/neo-manifest.json has no contracts field — game runs unbound); MiniAppTarot 253 (deployed mainnet 0xb680225a per hardened hashes, but on-chain-tarot's manifest binds nothing today); MiniAppTarotVrf 1,216 (largest single contract; Morpheus-randomness tarot, 'compiled and mock-E2E tested; not deployed and not activated').

EVIDENCE: docs/MINIAPP_CREDITS_LEDGER.md:1-4; docs/reports/on-chain-tarot-vrf-contract-status-2026-07-11.md:1-5; deploy/scripts/deploy_selected_miniapp_contracts.go:72; deploy/hardened_hashes_2026-06-05.json:4; contracts/MiniAppCoinFlipV2/MiniAppCoinFlipV2.cs:1-4

DESIGN IMPLICATION: A fifth of in-repo per-app sources are dead or waiting weight; v2 design should decide their fate explicitly (fold into platform contracts or deploy) rather than let the source/deployment drift grow.

### Platform contracts: only 2 of 5 are actually consumed

FACTS: PlatformAnchor (841 LOC, 'shared manual AA-agent routing anchor for TrustAnchor and ProfitAnchor') is bound by FIVE apps — trustanchor, trustanchor-admin, profitanchor, profitanchor-admin, custom-anchor — all sharing testnet 0xab079b4f / mainnet 0x02beeef6. MiniAppFactory (499 LOC, template registry + NEP-17/NEP-11 deploy factory) is bound by THREE apps — miniapp-factory, asset-factory, nft-factory — all at testnet 0x03a7c8fc (manifest.ts mode 'template'). PlatformGame (3,488 LOC, 'multi-tenant game engine that hosts Countdown (LastSurvivor), CoinFlip (FogPlay), Gacha (GASBox), and Dice... namespaced by appId') is DEPLOYED on testnet 0xc311d55e (2026-06-03) and mainnet 0xa7840a8d but ZERO apps bind it — fogplay was registered on an older PlatformGame in May 2026 then moved to standalone MiniAppCoinFlipV2. PlatformDeFi (2,628 LOC, 'multi-tenant DeFi engine consolidating SelfLoan, FlashLoan, and CompoundCapsule') has a testnet deployment record 0x39d4584d but ZERO bindings — the flashloan app deliberately binds the frozen legacy appId-free MiniAppFlashLoan (mainnet 0xb5d8fb0d / testnet 0xde8e595d) and self-loan binds standalone MiniAppSelfLoan. PlatformSocial (1,767 LOC, 'consolidating RedEnvelope, HeritageTrust, and UnbreakableVault') has NO deployment record found in the repo and zero bindings; its current Vault ABI (CreateVault/CommitAttempt/RevealAttempt) doesn't even match what the unbreakable-vault app calls (attemptBreak).

EVIDENCE: contracts/platform/PlatformAnchor/PlatformAnchor.cs:23; contracts/platform/PlatformGame/PlatformGame.cs:24-27; contracts/platform/PlatformDeFi/PlatformDeFi.cs:43; contracts/platform/PlatformSocial/PlatformSocial.cs:39; contracts/build/testnet_game_deployment.json:1-20; contracts/build/mainnet_game_deployment.json:1; contracts/build/testnet_anchor_deployment.json:1-10; apps/flashloan/src/composables/useFlashloanCore.ts:1-18; contracts/platform/PlatformSocial/PlatformSocial.Vault.cs:1

DESIGN IMPLICATION: The multi-tenant platform-contract idea is already proven by PlatformAnchor (5 apps, 1 deployment) and MiniAppFactory (3 apps), but PlatformGame/DeFi/Social show that consolidation without app migration and ABI stability yields deployed-but-dead estate. v2 must ship with migration of bindings, not just contracts.

### Scenario classification of the 34 per-app contracts

FACTS: game-reward/TEE-settled skill: 11 (AimMaster, ColorClash, CurveArrow, FlappyDash, Game2048, MergeKingdom, PetPotion, SnakeBounty, Sudoku, JumpRush, SheepSolitaire). house-banked betting commit/reveal: 4 (CoinFlip, CoinFlipV2, DiceGame, DiceGameV2). gacha/mystery-box: 2 (GasBox, GasBoxV2). lottery/pot: 1 (LastSurvivor). social gifting: 1 (RedEnvelope). escrow: 2 (MilestoneEscrow staged-release, BreakupPact two-party pact). time-lock vault: 1 (TimeCapsule). lending: 1 (SelfLoan). tipping: 1 (TipJar). NFT ticketing: 1 (EventTicketPass, NEP-11+QR). soulbound credential: 1 (SoulboundCertificate). public-goods funding: 1 (QuadraticFunding). governance market/staking: 1 (GovMerc, NEO deposits + GAS epoch bids). burn competition: 1 (BurnLeague). custody multisig: 1 (Multisig, M-of-N). engagement/check-in streak: 1 (DailyCheckin). paid randomness/content: 2 (Tarot, TarotVrf). platform credits ledger: 1 (Credits). Platform scenarios already covered by multi-tenant engines: game (countdown/coinflip/gacha/dice in PlatformGame), DeFi (loan/flashloan/capsule in PlatformDeFi), social (envelope/trust/vault in PlatformSocial), staking-anchor (PlatformAnchor), deploy-factory/registry (MiniAppFactory).

EVIDENCE: contracts/MiniAppAimMaster/MiniAppAimMaster.cs:13; contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.cs:1; contracts/MiniAppGovMerc/MiniAppGovMerc.cs:1; contracts/MiniAppTarotVrf/MiniAppTarotVrf.cs:27; contracts/MiniAppCredits/MiniAppCredits.cs:13; contracts/platform/PlatformGame/PlatformGame.cs:49

DESIGN IMPLICATION: Scenario space is ~17 distinct shapes but heavily skewed: game-reward (11) + betting/gacha (6) + pot/gift (2) = 19 of 34 are variations of 'stake GAS, resolve fairly, pay out' — one parameterized settlement kernel covers >half the estate. Escrow/vault/pact (4 more) share a second 'conditional release' shape.

### Zero-deploy census: 25 of 77 apps bind no contract at all

FACTS: All 77 apps have a neo-manifest.json; 52 declare a contracts map (57 unique hashes across neo-n3-mainnet/testnet/neo-x), 25 declare none: arrow-escape, automation-copilot, bead-workshop, curve-arrow, explorer, forever-album, fruit-funnel, gas-lucky-pool, neo-convert, neo-sign-anything, neo-swap, neo-treasury, neo-x-bridge, neodid-passport, on-chain-tarot, oracle-compute-lab, oracle-http-console, oracle-neodid-console, oracle-seal-console, oracle-vrf-console, private-transfer, screw-sort, timestamp-proof, wallet-health, zhuada-e. Note neo-message binds ONLY a Neo X EVM contract (0xd1906192), so 25 is the honest 'nothing at all' count and 26 would be the 'nothing on Neo N3' count. apps/shared/constants/generated-miniapp-contracts.ts is generated from these manifests and is the runtime source of truth.

EVIDENCE: apps/shared/constants/generated-miniapp-contracts.ts:1-6; apps/on-chain-tarot/neo-manifest.json:1; apps/curve-arrow/neo-manifest.json:1; apps/neo-message/neo-manifest.json:1

DESIGN IMPLICATION: One-third of the fleet already lives the zero-deploy vision (consoles, tools, guest-mode games). The interesting frontier is the 5 unbound GAMES (curve-arrow, gas-lucky-pool, screw-sort, zhuada-e, arrow-escape, fruit-funnel, bead-workshop) that could go on-chain with zero deployment if a shared reward contract existed.

### 14 apps bind contracts whose source is NOT in contracts/ today (legacy/external estate)

FACTS: Named by docs/reports/mainnet-contract-update-coverage-latest.json (27 mainnet contracts the platform tracks): aa-account-lab/aa-permissions-lab/aa-relay-console → UnifiedSmartWalletV3 (0x0268a387 mainnet / 0xdbf38e7b testnet); aa-market-hub → AAAddressMarket; aa-session-key-lab → SessionKeyVerifier; council-governance → MiniAppCouncilGovernance; gas-sponsor → MiniAppGasSponsor; graveyard → MiniAppGraveyard (testnet 0xb55aa635); memorial-shrine → MiniAppMemorialShrine (appId-memo multi-tenant-style payment protocol); neo-pay + neo-pay-shared-example → MiniAppNeoPay; neo-ns → NameService (official NNS 0x50ac1c37); oracle-price-console → legacy DataFeed OS service (0x9bea75cf testnet); recovery-guardian → SocialRecoveryVerifier; unbreakable-vault → MiniAppUnbreakableVault; flashloan → MiniAppFlashLoan (frozen). These sources were deleted in two historical migrations: 'refactor: migrate to modular kernel architecture' (deleted AppRegistry, Governance, PauseRegistry, MiniAppCouncilGovernance, MiniAppGasSponsor, MiniAppGraveyard, MiniAppMemorialShrine, MiniAppNeoPay, MiniAppDevTipping, MiniAppOnChainTarot, etc.) and 'feat: consolidate 9 per-app contracts into 3 platform contracts' (deleted MiniAppFlashLoan, MiniAppUnbreakableVault, MiniAppHeritageTrust, MiniAppFogPlay, MiniAppGASBox, MiniAppCompoundCapsule, and old LastSurvivor/RedEnvelope/SelfLoan). deploy/config/testnet.json still lists 10 more legacy OS 'Service' contracts (StorageService, PaymentService, GameService, EscrowService, NFTService...).

EVIDENCE: docs/reports/mainnet-contract-update-coverage-latest.json:1; deploy/config/testnet.json:9-21; deploy/scripts/smoke_business_workflows.js:23-32; apps/memorial-shrine/src/composables/useMemorialShrine.ts:37-42

DESIGN IMPLICATION: The on-chain estate is three generations deep (OS services → modular kernel/platform trio → standalone re-write) and 14 apps still ride generation-1/2 deployments the repo can no longer rebuild. v2 must either re-home these apps or accept permanently frozen ABIs as fixed integration points.

### History arc: consolidation was tried, then reversed into standalone contracts

FACTS: Commit ab9022631/ebefebb7d consolidated 9 per-app contracts into PlatformDeFi/PlatformGame/PlatformSocial. The current generation then re-introduced standalone contracts whose doc headers explicitly reject the kernel: MiniAppCoinFlip 'the FogPlay app routed bets through the OS game/payment kernel and...', MiniAppRedEnvelope 'previously routed create/claim through the...', MiniAppTipJar 'previously routed tips through the OS PaymentProxy edge function', MiniAppLastSurvivor/SelfLoan/TimeCapsule/GovMerc/BurnLeague similar 'NO oracle / OS kernel' rationale. Result today: standalone contracts hold every live binding while the three multi-tenant engines sit deployed-but-unbound (or undeployed). Separately, mainnet domain coverage reports 12 chain_mismatch bindings out of 46 — legacy and new hashes coexisting under NNS domains.

EVIDENCE: contracts/MiniAppCoinFlip/MiniAppCoinFlip.cs:1-5; contracts/MiniAppTipJar/MiniAppTipJar.cs:1-4; contracts/MiniAppRedEnvelope/MiniAppRedEnvelope.cs:1-5; docs/reports/contract-domain-coverage-latest.json:1-25

DESIGN IMPLICATION: The pendulum has swung consolidation→standalone once already; the recorded reasons (kernel coupling, trust path, per-app upgrade autonomy) are requirements the v2 platform-contract design must answer, or apps will defect to standalone again.

### Source-level reuse already exists via MiniApp.DevPack bases

FACTS: MiniAppMoneyBase is the 'shared money base for NEW standalone miniapp contracts' (admin, pause, GAS custody); MiniAppHouseGameBase(+Settle) is the 'shared commit/reveal engine for house-banked GAS games (CoinFlipV2, DiceGameV2, ...)'; MiniAppCompactBase is the minimal admin/pause/gateway/upgrade base. QuadraticFunding extends a MiniAppBase with a pause-registry isPaused callback permission. So dedupe currently happens at compile time (inheritance) while every app still pays its own deployment — 27 live deployments of largely shared logic.

EVIDENCE: contracts/MiniApp.DevPack/MiniAppMoneyBase.cs:1-4; contracts/MiniApp.DevPack/MiniAppHouseGameBase.cs:1-3; contracts/MiniApp.DevPack/MiniAppCompactBase.cs:1-3; contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.cs:1-8

DESIGN IMPLICATION: The DevPack base ABIs are the de-facto spec of what a multi-tenant platform contract needs to expose per tenant (money custody, commit/reveal, pause, admin, upgrade); lifting them from base-class to appId-namespaced storage is the shortest path to the zero-deploy goal.

### Where deployment truth lives

FACTS: Authoritative artifacts: contracts/build/*.json deployment records (testnet_game_deployment, mainnet_game_deployment, testnet/mainnet_anchor_deployment, selected_miniapps_redeployed_{testnet,mainnet}, selected_miniapps_tee_signer_testnet, *_platform_update_latest); deploy/hardened_hashes_2026-06-05.json (6 hardened mainnet miniapp hashes); apps/*/neo-manifest.json → generated registry apps/shared/constants/generated-miniapp-contracts.ts; docs/reports/mainnet-contract-update-coverage-latest.json (27 update-tracked mainnet contracts); per-app TESTNET_STATUS.md exist only for dice-game, private-transfer, unbreakable-vault. Deploy tooling: deploy/scripts/deploy_selected_miniapp_contracts.go (roster of 34 name→app pairs incl. 8 stale rows pointing at build artifacts that no longer exist, e.g. MiniAppDevTipping, MiniAppGraveyard, MiniAppTurtleMatch), deploy_game_testnet.go, deploy_anchor_{testnet,mainnet}.go, update_platform_contracts.go, plus ~24 live_validate_*.mjs harnesses that resolve hashes from app manifests.

EVIDENCE: contracts/build/testnet_game_deployment.json:1; deploy/hardened_hashes_2026-06-05.json:1; deploy/scripts/deploy_selected_miniapp_contracts.go:49-88; deploy/scripts/live_validate_tipjar.mjs:4; apps/dice-game/TESTNET_STATUS.md:1

DESIGN IMPLICATION: There is no single contract-estate ledger — truth is spread across build records, a generated TS registry, hardened-hash snapshots, and an update-coverage report; a v2 registry contract (or at least one canonical estate file) would remove this class of drift, including the 8 stale roster rows.

### LANE SUMMARY
Full contract-estate census of the 77-app Neo N3 miniapp platform. In-repo: 42 contract projects (~31.1k LOC) — 34 per-app MiniApp* standalone contracts (20,749 LOC), 5 platform contracts (9,223 LOC), the MiniApp.DevPack shared-base library, and 2 test fixtures. Bindings (source of truth: apps/*/neo-manifest.json → generated-miniapp-contracts.ts): 52 apps bind 57 unique hashes; 25 apps bind nothing and already live the zero-deploy vision. Of the 34 per-app sources, 27 have live app bindings and 7 are dead/waiting (CoinFlip v1, DiceGame v1, GasBoxV2, Credits [not deployed], CurveArrow [unbound], Tarot [deployed, binding removed], TarotVrf [not deployed]). Of the 5 platform contracts, only PlatformAnchor (5 apps) and MiniAppFactory (3 apps) are consumed; PlatformGame and PlatformDeFi are deployed on-chain with zero bindings and PlatformSocial has no deployment record — the 2026 consolidation of 9 per-app contracts into these engines was subsequently reversed into today's standalone generation, whose doc headers record why (kernel coupling, trust path). 14 apps still bind three-generations-old contracts whose sources were deleted from the repo (UnifiedSmartWalletV3, MiniAppNeoPay, MiniAppGasSponsor, DataFeed, official NNS, frozen MiniAppFlashLoan, legacy GasBox with paused writes, etc.). Scenario skew: 19 of 34 per-app contracts are variants of stake→fair-resolve→payout (11 TEE skill-game clones of ~815 LOC each, 4 commit/reveal bets, 2 gacha, pot, envelope), and 4 more are conditional-release (escrow/pact/vault/timelock) — so two parameterized platform scenarios cover ~two-thirds of the estate. Key design lesson for the zero-deploy goal: PlatformAnchor proves one deployment can serve 5 apps, PlatformGame/DeFi/Social prove consolidation fails without binding migration and ABI fidelity, and the DevPack base classes already define the per-tenant surface a v2 multi-tenant contract must expose.
