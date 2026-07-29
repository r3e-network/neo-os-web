# Platform Contract Library v2 — Registry-Anchored Engine Estate

**Status:** Final synthesized architecture, amended 2026-07-23 to make shared UnifiedSmartWallet accounts the default app identity
**Audience:** neo-os-web maintainers
**Landing path:** `docs/platform-contract-library-v2.md`
**Ground truth:** the 2026-07-16 estate census (HEAD `020b53d87`, raw lane results in `docs/archive/claudedocs/contract-estate-census-2026-07-16.md`); every number below is cited from it. Trust the tests, not the README — `contracts/README.md` is measurably stale.

---

## 1. Vision & non-goals

### Vision

The platform contract suite provides so much generic on-chain functionality that a miniapp or game deploys **nothing** (lane A: register an appId + descriptor on a shared engine) or only a **thin DevPack shim** (lane B: bespoke logic over shared source, since Neo N3 has no deployed-code inheritance). The hard requirement is satisfied structurally: **registration creates a deterministic, unique virtual abstract-account address for every registered app inside one shared UnifiedSmartWallet core**. A deployed `AppAccount` is an optional lane-C treasury shim, not a registration prerequisite.

Three design laws, each derived from a measured failure:

1. **No engine ships without its first tenant's binding cutover in the same release train.** PlatformGame/DeFi/Social were built, audited, and deployed — and have **zero** live bindings today because migration was an afterthought (census lane 6).
2. **The framework's hardcoded ABI is preserved verbatim.** `startGame/finalizeGame/expireGame/withdraw` + reads `freePool/creditOf/activeGameOf/getGame/statsOf`, events `Solved/CreditWithdrawn` (`framework/gamefi/reward-game-sdk.ts:245-252`, `funds.ts:362-386`, `game-facade.ts:350,374`). Keeping these names buys the entire existing client surface for the cost of appId threading.
3. **Apps can always leave.** Timelocked everything, per-app pause autonomy, pause-immune witness-gated exits, and a treasury escape hatch. The recorded defection rationale (kernel coupling, trust path, upgrade autonomy — census lane 6 "history arc") is answered by credible exit, not by promises.

### Non-goals

- **Not covered, deliberately** (net-new product design, no fleet demand evidence): AMM/swap router (neo-swap's own README gates it behind five enablement conditions), NFT marketplace (no listing/auction/royalty code exists anywhere), prediction markets/insurance, pull-based variable subscriptions (Neo N3 has no allowance primitive), a platform DID registry (adopt external NeoDIDRegistry as a pinned dependency), name service (official NNS **is** the service), plain payments (native tokens suffice). Counting these as covered would repeat the README's stale-docs sin.
- **Not duplicating the external AA stack.** UnifiedSmartWallet-V3, session keys, relay, and social recovery are the default app/user account substrate. `PlatformRegistry` acts only as a timelocked registrar; `AppAccount` remains optional for isolated app treasuries.
- **Not forcing migration** of healthy standalone contracts (the wager quartet: fogplay/dice-game live-validated on CoinFlipV2/DiceGameV2) or of MiniAppCredits (already the working zero-deploy exemplar: shared contract + DB attribution).
- **No chain writes from this workstream.** Testnet/mainnet deployment is the user's action, always behind the existing confirm-phrase tooling. Phase 1 is source + tests only.

### 1.1 Shared-AA amendment (supersedes conflicting minted-shim text below)

- `PlatformRegistry.abstractAccountCore` is a 24-hour-timelocked pointer. Non-zero activation also verifies the reciprocal AA `getPlatformRegistrar()` points back to the Registry, so governance cannot enable a one-sided configuration. When set, `registerApp` automatically calls the stable V2 `computeStablePlatformAccountId` and `registerStablePlatformAccount`; pre-existing rows use idempotent `materializeAbstractAccount(appId)`. Legacy `computePlatformAccountId`/`registerPlatformAccount` remain in the AA ABI for compatibility. Stable V2 derives the account id from the Registry/app binding and escape timelock rather than mutable app-admin ownership, while the current app admin is stored as backup owner and can rotate without changing the predicted address. The same timelock can set the pointer back to zero as an operational rollback: existing identities remain indexed, while new registrations return to directory-only mode.
- `UnifiedSmartWallet.platformRegistrar` is independently timelocked for seven days. `registerStablePlatformAccount` accepts calls only from that registrar and registers a zero-plugin account with the app's `appAdmin` as backup owner; the legacy `registerPlatformAccount` lane remains available for old callers. The platform cannot install plugins, sign, or spend for the app. A matured Registry app-admin rotation uses the same registrar gate and stored `(Registry, appId)` binding to update `BackupOwner` without changing the stable account id; active market-escrow or escape state rejects the rotation.
- Account uniqueness is domain-separated by `Runtime.ExecutingScriptHash + appId`; Registry stores `(core, accountId)` and a core-scoped reverse index. Framework derives the verification script, display-order script hash, and Neo address without a per-app deployment.
- The old per-app `AppAccount` mint lane stays available for explicit treasury isolation. A 77-app dry-run estimated `771.29012379` GAS system fee plus `23.10000000` GAS network fees, so it is economically incompatible with the default zero-deploy path.
- Live testnet truth is currently 77/77 active directory rows, 0/77 shared-AA materializations, and a Registry bytecode version that lacks this ABI. Source/test completion is not deployment completion.

---

## 2. Estate today (census numbers)

- **77 apps; 52 bind contracts (57 unique hashes); 25 bind nothing** — one-third of the fleet already lives the zero-deploy vision. Among the unbound are 6-7 *games* (curve-arrow, screw-sort, zhuada-e, arrow-escape, fruit-funnel, bead-workshop, gas-lucky-pool) that would go on-chain the day a shared reward engine exists.
- **In-repo contract census:** 34 per-app MiniApp\* contracts plus the platform engine suite (MiniAppFactory, PlatformAnchor, PlatformDeFi, PlatformEscrow, PlatformGame, PlatformRegistry, PlatformSocial, and PlatformVesting), MiniApp.DevPack, and two fixtures. The generated platform acceptance ledger is the current source of truth for source/build/test status and deployment evidence.
- **Platform adoption is bimodal.** Alive: PlatformAnchor (5 apps, one deployment, the fleet's only permissionless registration — `RegisterCustomAnchorApp`, appAdmin witness + 1 GAS fee from prepaid credit, audit M-11) and MiniAppFactory (3 apps, testnet `0x03a7c8fc…`, digest-verified `ContractManagement.Deploy`, audit A11). Dead: PlatformGame (deployed testnet `0xc311d55e` + mainnet `0xa7840a8d`, **zero bindings** — fogplay was registered on it in May 2026, then defected), PlatformDeFi (testnet `0x39d4584d`, zero bindings), PlatformSocial (no deployment record found; its Vault ABI doesn't even match the live unbreakable-vault app).
- **Why the dead trio died** (recorded, not inferred): a non-operational Morpheus VRF signer dependency (`apps/gasbox/src/composables/useGasBox.ts`), admin-only registration, economics frozen as compile-time consts with a registration config blob **no code ever reads** (`GetGameConfig` exists; no module consumes it; the deploy script passes `[]byte{}`), and no shipped binding migration.
- **The clone family:** 10-11 TEE skill-game contracts of ~811-843 LOC each, >90% identical (~6,800-7,300 duplicated lines). Measured diff AimMaster vs ColorClash: `Play.cs` = **0 lines**; the whole per-game surface is constants (per-difficulty entry/reward/LimitMs/MinSolveMs/TargetScore, dailyCap, `SETTLE_GRACE_MS = 600_000` copied verbatim 11×). JumpRush + SheepSolitaire still carry the superseded bespoke secp256r1 trust model.
- **Duplication census:** 38 `OnNEP17Payment` receivers; 23 `PREFIX_CREDIT` ledgers with total-liability tracking in only **2 of 23**; 3 divergent reentrancy locks; 36 `Update` methods (3 with timelocks); 19 `SetPaused` copies; `AppKey(appId, …)` re-implemented 4×; a de-facto event vocabulary (`CreditWithdrawn` ×27, `Credited` ×25, `Solved` ×20, `PausedChanged` ×13).
- **No on-chain appId→address registry exists.** Runtime truth is `neo-manifest.json` → generated `apps/shared/constants/generated-miniapp-contracts.ts`; deployment truth is spread across build records, hardened-hash snapshots, and coverage reports (including 8 stale deploy-roster rows and **two divergent PlatformAnchor testnet hashes**: manifests `0xab079b4f…` vs update record `0xeb6b3725…`).
- **Constraints:** GAS-only payments, NEO-only governance by blueprint; contract hash = f(sender, nefChecksum, manifestName); no on-chain code sharing (DevPack `Compile Include` is the sharing mechanism, adopted by only 6/39 contracts); the nccs DevPack cannot declare events or `[InitialValue]` on base classes; a FAULTing NEP-17 callback hangs TestEngine.

---

## 3. Architecture

Five contract deliverables plus a DevPack base and framework surfaces. One new spine, one new minted shim, and evolutions of contracts that already exist — **no parallel replacement estate**.

```mermaid
flowchart TB
    subgraph Apps["77 miniapps (lane A: deploy nothing)"]
        A1["curve-arrow, color-clash, …<br/>neo-manifest.json ContractBinding.mode='shared'"]
    end
    subgraph FW["framework/ (client)"]
        F1["app.platformGame surface<br/>(app.credits config-injection pattern,<br/>auto-threads appId + scriptHash)"]
        F2["framework/utils/aa-account.ts<br/>+ deriveAppAccountHash (advisory)"]
    end
    subgraph Spine["PlatformRegistry (NEW — the spine)"]
        R1["Registry: registerApp (permissionless, fee-paid)<br/>lite tier ≈1 GAS / full tier mints account"]
        R2["Directory: appAccountOf / appIdOfAccount /<br/>engineOf / getApp — the estate ledger"]
        R3["Engine table: registerEngine (timelocked)<br/>= the extension mechanism"]
        R4["Descriptor: setDescriptor →<br/>engine-side validateAndApplyDescriptor"]
        R5["Treasury policy: role-bound spend lanes only"]
        R6["Governance: 24h timelocks, two-tier,<br/>global + per-app pause"]
    end
    subgraph AA["AppAccount (minted per app, one canonical NEF)"]
        AC["holds NEP-17 (GAS/NEO v1)<br/>local cache: appId, registry, appAdmin<br/>executeTransfer (registry-only) + escapeExecute"]
    end
    subgraph Engines["Engine estate (registered rows in the engine table)"]
        E1["PlatformGame v2 (EVOLVED in place)<br/>+ RewardGame module (GameType 5)<br/>Countdown/CoinFlip/Gacha/Dice → descriptor economics"]
        E2["PlatformAnchor (LIVE, 5 apps)<br/>grandfathered as engine row, untouched"]
        E3["MiniAppFactory (LIVE, 3 apps)<br/>grandfathered as engine row, untouched"]
        E4["PlatformFinance / PlatformSocial v2 (phase 3)<br/>Tipping, Notary, Streams, Escrow"]
    end
    subgraph DevPack["MiniApp.DevPack v2 (lane B: thin shims)"]
        D1["MiniAppEngineBase.cs — canonical AppKey kit,<br/>(appId,payer) ledger WITH liability counter,<br/>3 lock granularities, activateApp plumbing,<br/>pause-registry consult"]
    end
    Oracle["Morpheus TEE session kernel (operational)<br/>caller==Oracle(), 79-byte result codec"]

    Apps --> FW
    F1 -->|"invoke (appId, …)"| E1
    R1 -->|"ContractManagement.Deploy<br/>(storedNef, name=appId)"| AC
    R1 -->|"push activateApp(appId, admin, descriptor)"| E1
    R3 --- E1 & E2 & E3 & E4
    R5 -->|"executeTransfer (only caller)"| AC
    AC -->|"fundEnginePool → memo 'appId:credit'"| E1
    E1 <-->|"submitMiniAppRequestFromIntegration /<br/>onMiniAppResult"| Oracle
    D1 -.->|"Compile Include (source-level)"| E4
    R6 -.->|"isPaused consult<br/>(CompactBase 0x05 slot, finally wired)"| DevPack
```

### 3.1 PlatformRegistry (new — `contracts/platform/PlatformRegistry/`, ~7 partials, each ≤300 lines)

Partials: `PlatformRegistry.cs` (events, consts, `_deploy`, timelocked `Update`), `.Registry.cs`, `.Accounts.cs`, `.Descriptor.cs`, `.Treasury.cs`, `.Governance.cs`, `.Directory.cs`.

**Why a new contract rather than extending live MiniAppFactory** (the one point where the two judges' winners diverged): bootstrapping the spine must not require an in-place upgrade of a live contract with 3 consumers, and the registry's surface (governance, treasury policy, descriptors, directory) is a different product than the factory's digest-verified deploy lane. The factory stays untouched, keeps its ABI, and is grandfathered as engine row #2. The registry *reuses the factory's proven idioms in source* (template-artifact storage, digest pinning) without touching its deployment. Adoption risk of a new spine is answered by cohort 0 (§7): all 77 apps registered additively before any rebinding is asked of anyone.

The app-facing integration layer now matches that spine instead of treating self-service registration as an ops-only exception. `app.registry` covers all 49 current non-control-plane ABI methods plus native GAS credit prepayment for `appId:credit`; it auto-threads the host app id, defaults account arguments to the connected wallet, and applies guest → `invoke:platform-registry` guards to every write. `app.platformAccount` is the application-facing composition boundary over that lower-level surface: one read returns the directory row, the materialized or deterministic shared UnifiedSmartWallet identity (core, account id, verification script, script hash, Neo address), and optional isolated AppAccount treasury hash without conflating identity and custody; its only write materializes the shared identity through the guarded Registry lane. Platform-admin governance, artifacts, engine registration, fee withdrawal, and contract updates are intentionally omitted. The generated ledger is 49/49 source-complete, but production bindings remain zero: the retained testnet Registry is `live-artifact-drift`, exposes only 41/49 of those tenant methods, and lacks shared-AA materialization, prediction, and spend-threshold completion. No app may inject that hash into `app.registry` until the exact Registry upgrade, reciprocal UnifiedSmartWallet configuration, and 77-account uniqueness/reverse-index dry-run all pass; this work performed no chain write.

Key ABI:

- **`registerApp(string appId, string engineId, UInt160 appAdmin, Map<string,object> descriptor)`** — **permissionless** for custom appIds, appAdmin witness, fee consumed from the caller's prepaid GAS credit (the PlatformAnchor M-11 model — the only registration path that ever attracted self-service tenants). The `miniapp-` namespace is reserved for the platform pipeline, so known and future platform-owned ids must use `registerAppByPlatform(...)` and cannot be squatted through the self-service lane.
  - The default registration creates the directory row and, when `abstractAccountCore` is configured, automatically materializes the shared AA identity. If the core is not configured, bootstrap registration remains directory-only and can be reconciled later.
  - `materializeAbstractAccount(appId)` is the idempotent migration entrypoint for existing rows. It is app-admin/platform-admin gated, pause-aware, and records both `(appId → core/accountId)` and `(core/accountId → appId)`.
  - `mintAccount(appId)` remains a separate optional treasury-shim lane. Its ~10 GAS platform fee and `ContractManagement.Deploy` system fee are never prerequisites for registration or shared-AA completeness.
  - Validates `appId` ≤64 chars, unique (`PlatformGame.Registry.cs:43` pattern); resolves the engine row; **pushes** the tenant into the engine via `Contract.Call(engineHash, "activateApp", appId, appAdmin, descriptor)` so engines never pay a cross-contract registry read per gameplay call; emits `AppRegistered(appId, engineId, appAdmin, accountHash)`.
  - **`registerAppByPlatform(...)`** — the pipeline lane for ops tooling (the actual first 77 tenants will be registered by a Go script anyway).
- **`registerEngine(string engineId, UInt160 engineHash, BigInteger schemaVersion)` / `retireEngine`** — platform-admin, 24h-timelocked propose/execute pair; asserts `ContractManagement.GetContract(engineHash) != null` (audit NEW-I-2 idiom). **This table is the extension mechanism** (§6): scenario N+1 is a new engine contract + one timelocked row — the registry is never upgraded to add a domain, and a defective engine is retired without touching identity or treasury (RMAA's failure-isolation graft).
- **`setDescriptor(appId, key, value)`** — app-admin witness; keys are namespaced `engineId:param`; the registry forwards to `engine.validateAndApplyDescriptor(appId, key, value)`, which enforces per-engine validated ranges. **Descriptors are consumed, engine-side, with bounds** — the structural fix for PlatformGame's dead config blob.
- **Directory reads (all `[Safe]`):** `getApp(appId)` keeps the optional treasury-shim fields; `getAppAbstractAccount(appId)` returns `{core, accountId, materialized}`; `getPredictedAbstractAccount(appId)` returns the same deterministic tuple with `materialized=false` before AA-core registration; `appIdOfAbstractAccount(core, accountId)` is the core-scoped reverse index; `appAccountOf/appIdOfAccount` remain the optional shim index; `engineOf` and enumeration reads complete the estate ledger.
- **Governance:** `proposeAdmin/executeAdminChange/cancelAdminChange` with `TIMELOCK_DELAY_MS = 86_400_000` (copied from the audited `PlatformGame.Admin.cs`, the version whose seconds-vs-ms bug was already fixed); two-step `setAppAdmin` per app; `setAppPaused` (app-or-platform admin); `setGlobalPaused` kill switch with a recorded `pausedAt`; `isPaused(appId)` read that engines and lane-B shims consult — the CompactBase `PREFIX_PAUSE_REGISTRY` 0x05 slot, reserved since forever, finally gets a real target.
- **Treasury policy (`.Treasury.cs`):** §4.3. No method anywhere takes a free `UInt160 recipient` — destinations are role-bound (FinancialTransferSafetyTest grammar).
- **`OnNEP17Payment`:** memo `appId:credit` → (appId,payer)-scoped prepaid credit (the PlatformGame model, chosen deliberately over DeFi/Social's payer-global ledgers for attribution completeness); credit-only, zero outbound transfers; `withdrawCredit(appId, amount)` witness-gated and pause-immune (anchor invariant). Registered in `OnNep17PaymentConventionTests.MoneyContracts()`.

Storage (single-byte prefixes; 0x01–0x0F registry core, 0x10–0x1F app rows, 0x20–0x2F engine table, 0x70 credit — documented reserved map): `0x01` admin, `0x02` pendingAdmin+eta, `0x03` globalPaused+pausedAt, `0x04` AppAccount artifact (nef + manifest halves + version), `0x05` fees, `0x10` app core row, `0x11` appId→account, `0x12` app paused, `0x13` descriptor entries, `0x14` attached engine, `0x15` pending app-admin rotation, `0x16` payout address (+pending/eta), `0x17` shim-upgrade consent flag, `0x20` engine records, `0x21` engineHash→engineId, `0x22` account→appId, `0x70` prepaid credit.

### 3.2 AppAccount (optional treasury shim — one canonical NEF, deployed only on demand)

Deliberately tiny; full lifecycle in §4. Local state: `0x01` appId, `0x02` registry hash, `0x03` appAdmin (cached, push-refreshed), `0x04` paused. Methods: accept-only `OnNEP17Payment` (GAS/NEO in v1) emitting `Received(appId, asset, from, amount)`; `executeTransfer` (registry-caller-only); `escapeExecute` (escape hatch); `update()` (registry-orchestrated, consent-gated); `[Safe]` reads. No `Destroy`, no free-destination method, no other surface.

### 3.3 PlatformGame v2 (evolve **in place** — new RewardGame module)

The deployed-but-dead hull is the lowest-risk update in the estate (zero users; its 24h-timelocked `Update` exists precisely for this) — and reusing it means v2 *shrinks* the graveyard instead of minting a sibling engine next to a dead one (the judges' shared objection to RMAA's new-engine move). New partials, all additive: `PlatformGame.RewardGame.cs`, `.RewardGame.Settle.cs`, `.RewardGame.Reads.cs`, `.RewardGame.Descriptor.cs`.

- **ABI = the clone ABI, verbatim, appId-first:** `startGame(appId, player, difficulty)`, `finalizeGame(appId, player, sealedOpLog)` (calls the Morpheus kernel `submitMiniAppRequestFromIntegration(player, appId, "game.session", "session.finalize", sealedOpLog)`), `onMiniAppResult` (assert `caller == Oracle()`, parse the unchanged fixed 79-byte codec `0x02‖commitment(32)‖answerHash(32)‖elapsedMs(u64BE)‖undos(u8)‖score(u32BE)‖difficulty(u8)`, dispatch by stored `(appId, operationId)` context — the existing `OnOracleResult` pattern), permissionless `expireGame`, pull-payment `withdraw`, reads `freePool/creditOf/activeGameOf/getGame/statsOf`. Events `Solved/GameStarted/GameExpired/CreditWithdrawn` carry appId as first field (declared once on the concrete class, per the compiler constraint).
- **Economics are descriptor data**, range-validated in `validateAndApplyDescriptor`: per-difficulty `{entry, reward, limitMs, minSolveMs, targetScore}`, `dailyCap`, `undoPenaltyBps` (default 3000), `settleGraceMs` (default 600_000 — finally one copy of the constant). Payout = `reward × (10000 − undoPenaltyBps × undos) / 10000` when `score ≥ targetScore`; refund-on-failure. Trust root stays the kernel `RUNTIME_VERIFIER` — the **operational** Morpheus *session* kernel the 10 clones use in production today, **not** the non-operational VRF signer that killed v1 adoption.
- **Per-app pool/reserved/credit sub-ledgers with a mandatory per-app liability counter** (`heldForApp == pool + reserved + Σcredits`; `reserved ≤ pool`) — the census found solvency tracking in only 2 of 23 ledgers; here it is structural and covered by a randomized model-based invariant test (AnchorRewardAccountingInvariantTest style).
- Existing Countdown/CoinFlip/Gacha/Dice modules get their const economics lifted to descriptor keys in a later pass (no consumer is waiting on it). `RegisterGame` gains gameType 5 and is kept for back-compat; tenant rows normally arrive via `activateApp` from the registry.

### 3.4 PlatformFinance + PlatformSocial v2 (phase 3, each behind a named first tenant)

Add per-app fee accumulators + sweeps to Social (census: it has none); reconcile the Vault ABI with unbreakable-vault or retire the module; add `Social.Tipping` (TipJar with payee abstraction + platform fee bps), `Finance.Streams` (NeoPay semantics re-implemented in-repo: createStream/claimStream/cancelStream, linear+cliff — the highest-value un-forkable external), and `Finance.Escrow` (MilestoneEscrow + tenancy + a release-condition axis: creator-approve | deadline | M-of-N). The former payer-global Social GAS/NEO ledgers are now `(appId,payer)`-scoped with exact `appId:credit` routing, tenant/global liabilities, pause-immune exits, and post-transfer solvency assertions on every Envelope, RangePool, Trust, and Vault business payout; all Trust/Vault fee transfers are assert-wrapped. `Social.Notary` is implemented locally as an immutable tenant-scoped digest → submitter/time/block record. Both remain behind the same deployment and named-tenant gate. These follow, never lead.

`PlatformEscrow` is now the first local Finance.Escrow engine slice: it provides appId-scoped native GAS/NEO credit funding, single-creator or bounded M-of-N milestone approval, claim/cancel/reclaim exits, and tenant/global liability accounting. Its framework surface and the `milestone-escrow` compatibility route remain host-configured and fail closed until deployment, Registry binding, funded lifecycle, and migration read-back are separately proven.

The app-facing integration layer now exists without changing that deployment gate: `app.platformSocial` covers all 36 non-admin methods in the current PlatformSocial manifest, including Notary plus tenant/global credit-liability reads, and adds guarded native GAS/NEO prepayment lanes. It auto-threads the host `appId`, emits the exact `appId:credit` memo, auto-targets the injected shared hash, defaults account arguments to the connected wallet, and applies the framework's guest → `invoke:platform-social` write policy. A composable `manifest.platformBindings` map now supplies independent hashes for Registry, Game, Social, Anchor, DeFi, Vesting, Escrow, and network-specific Factory surfaces without displacing the app's primary `contract`; legacy `ContractBinding.mode='shared'` module bindings remain supported as a fallback. Timestamp Proof has a durable dual path that uses Notary only when this explicit binding is present and otherwise preserves its zero-GAS self-transfer verifier. The generated interface ledger passes 36/36 and records zero configured production consumers; the retained testnet ledger still says `no-deployment-record`, so this source/API completion is not runtime adoption proof.

PlatformAnchor now has the same app-facing boundary: `app.platformAnchor` covers all 32 tenant ABI methods plus the real native-NEO `transfer(..., "stake:<appId>")` deposit lane, auto-threads the host app id, defaults account arguments to the connected wallet, and applies guest → `invoke:platform-anchor` guards to every write. TrustAnchor and ProfitAnchor use this surface for all user reads/writes while preserving their pending-transaction recovery callbacks; the operator consoles remain an explicit cross-tenant control-plane exception. The generated interface ledger is source-complete, but the retained testnet deployment is `live-artifact-drift` (local checksum differs and the deployed ABI still has two removed methods), so this is not upgrade or live-compatibility proof and performed no chain writes.

`app.platformDeFi` now covers all 58 non-control methods in the current local PlatformDeFi v1.3 manifest plus native NEO/GAS prepaid deposits. It auto-threads the host app id, defaults account arguments to the connected wallet, retains transaction-sent/event-wait recovery hooks, and applies the same guest → `invoke:platform-defi` guard to every write. Native deposits carry the exact `${appId}:credit` memo; direct credits are keyed by `(appId,payer)`, tracked by per-app and global NEO/GAS liabilities, recoverable through pause-immune witness-gated withdrawals, and protected by post-transfer solvency checks after every business payout. SelfLoan is the named first-tenant source migration: profile `0x01` enforces one active loan per borrower and disables liquidation and abandonment, the framework exposes profile/active-position reads plus an atomic GAS-deposit-and-repay transaction, and the app retains its standalone path while shared mode fails closed on exact checksum/update-counter/ABI attestation and profile verification. Contract regression coverage also pins the fee-accounting invariant that separately sweepable origination fees are not left inside reported lending liquidity. This remains source readiness, not adoption: the generated ledger records zero shared bindings, the retained testnet artifact is `live-artifact-drift`, and no deployment, registration, funding, or manifest cutover was performed. A fresh exact-artifact deployment, profile-1 registration, funded lifecycle, drain/rollback proof, and explicit chain-write approval remain mandatory; FlashLoan and TimeCapsule still require separate named migrations.

**PlatformDeFi v1.2 is not storage-compatible with payer-global credits merely because prefix bytes are unchanged.** The deployed revision stores NEO and GAS credit as `0x14 || payer` and `0x15 || payer`; v1.2 uses the same prefixes with `appId || payer` keys and initializes new liability counters at `0x03`, `0x04`, `0x18`, and `0x19`. A legacy payer-only balance contains no deterministic tenant attribution. The local candidate therefore auto-pauses the first legacy upgrade, requires an exact payer-row snapshot and 32-byte snapshot hash, records legacy liabilities separately, blocks activation and unpause while underbacked, accepts only the exact `platform-defi:legacy-credit-topup` recovery memo, and lets each witnessed payer withdraw legacy credit after full backing. This bridge has three passing TestEngine lifecycle cases but is not chain-write authorization: the public snapshot, current deficit, exact artifact, every payer withdrawal, and final zero-liability state still require independent simulation and review. Because the current testnet deployment has zero tenant bindings, a fresh v1.2 deployment remains preferred.

MiniAppFactory now has an explicit `app.platformFactory` boundary covering all 13 non-admin ABI methods. Its network-indexed configuration prevents a plan for one network from silently targeting another, and `executeDeploymentCall` accepts only the three reviewed deployment operations with exact arity before entering the shared guest → `invoke:platform-factory` guard. Asset Factory, NFT Factory, the shared Factory runtime, and MiniApp Factory's durable registration path now route writes through this surface. Read-only direct RPC remains for `getcontractstate` and signer-aware fee simulation because the wallet bridge cannot express those probes. The retained testnet Factory still lacks `deployArtifactFromTemplate`, so Asset/NFT execution stays closed; this refactor performed no chain write and does not certify the local Factory artifact as live.

### 3.5 MiniApp.DevPack v2 — `MiniAppEngineBase.cs`

The lane-B/engine shared source (Compile Include, as today): the one canonical `AppKey(appId, prefix[, id|addr])` kit (today re-implemented 4×), the (appId,payer) credit ledger **with liability counter**, the three reentrancy-lock granularities (contract / tenant / account) as helpers, `RequireRegistered`/`RequireAppAdminOrPlatformAdmin`, `activateApp`/`validateAndApplyDescriptor` plumbing asserting caller==registry, and the pause-registry consult. Events stay declared per concrete contract with the documented vocabulary (compiler constraint). Reserved prefix map: 0x01–0x0F base/registry, 0x10+ engine modules.

### Trust model summary

| Authority | Holds | Cannot do |
|---|---|---|
| Platform admin (24h-timelocked rotation) | engine table, AppAccount artifact version (future mints), global pause, registry upgrade | **spend or redirect any app's funds** (no spend path over AppAccounts — extended "admin cannot harvest" invariant); instant anything (every power is timelocked) |
| App admin (2-step rotation, registry-pushed to shim) | descriptor within engine-validated ranges, payout address (timelocked change), engine attachment, own pause, shim-upgrade consent, treasury spend lanes, pause-immune exits | exceed descriptor ranges; spend to arbitrary destinations; block other tenants |
| Engines | tenant state under their own AppKey namespace | touch the registry's or accounts' storage; receive funds except via role-bound lanes |
| Morpheus kernel (`Oracle()`) | settle callbacks with the pinned codec | anything outside `onMiniAppResult` dispatch |

---

## 4. Per-app accounts — shared identity plus optional treasury isolation

### 4.1 Chosen mechanism

**Default: one shared UnifiedSmartWallet core with a unique virtual account per app.** At creation, Registry derives `appBinding = Runtime.ExecutingScriptHash + appId`, asks the core for `computePlatformAccountId(appBinding, appAdmin, 30 days)`, and registers that exact account through the independently-timelocked registrar. The app admin is the initial backup owner; verifier and hook start unset and remain under owner control. Later app-admin rotation updates the owner state through the stored binding without deriving a replacement account id. The framework turns `(core, accountId)` into the canonical `verify(accountId)` script, display-order script hash, and Neo address.

**Optional: a registry-minted thin treasury contract with one canonical audited NEF deployed per requesting app.** Neo N3 contract hash = f(sender, nefChecksum, manifestName), and contracts are first-class NEP-17 receivers. This lane exists for apps that require custody isolation, accept-only callbacks, registry treasury routing, and the escape hatch described below. It is not the abstract-account default and is not part of cohort completeness.

**Optional-shim hash-determinism honesty:** the `sender` component of `CreateContractHash` for a contract-initiated `ContractManagement.Deploy` is the **transaction sender — not the calling contract**. Counterfactual funding of the optional shim remains rejected. These rules apply only to `mintAccount`, not to the shared-AA virtual address, whose script is fully deterministic from `(core, accountId)`:

1. The hash derivation is a **hypothesis pinned by a phase-1 TestEngine measurement test** (deploy through the registry in-engine, record the observed hash, compare against both candidate derivations) — written **before** any prediction code.
2. **The registry row is the address-of-record.** `mintAccount` records the *actual* post-deploy hash; a `[Safe]` `predictedAccountHash` helper (and the TS sibling `deriveAppAccountHash` in `framework/utils/aa-account.ts`) is advisory and test-pinned against the measured value.
3. **No address is ever published before materialization.** No counterfactual funding. Funds flow to the address only after the row records the deployed hash — the stranded-funds vector is structurally closed.
4. Off-chain **precomputability survives** by routing minting through a fixed lane: the mint transaction's sender is the platform deployer used by the existing Go pipeline (predicted via `state.CreateContractHash(deployer, nef.Checksum, name)` exactly as `deploy_selected_miniapp_contracts.go` already does), or — if the in-engine measurement shows the calling contract is the sender after all — directly from the registry hash. Either way determinism holds *in practice*, and a shared test-vector JSON pins byte-exact C# / TestEngine / TS agreement.

**Mint.** Platform admin one-time-seeds the canonical artifact via timelocked `setAppAccountArtifact(nef, manifestHalves)` (the MiniAppFactory `RegisterTemplateArtifact` precedent — artifact bytes in registry storage, checksum-pinned; the manifest is stored as two halves and spliced with the appId name at deploy, covered by a fuzz-style splice test). Full registration (or later `mintAccount(appId)`) performs `ContractManagement.Deploy(storedNef, spliced manifest, initData=[appId, registryHash, appAdmin])`; the account stores all three locally in `_deploy` and the registry records the actual hash + reverse index, emitting `AppAccountMinted`. A post-deploy handshake (registry calls `bindRegistry()` on the fresh account and asserts the echo) replaces RMAA's non-implementable "`_deploy` asserts deployer == registry".

**Receive.** The address is a first-class NEP-17 receiver: user payments, sponsorships, and platform-module revenue sweeps (`GAS.Transfer(module, registry.appAccountOf(appId), …)` — a role-bound destination, "the app's treasury"). `OnNEP17Payment` accepts **GAS/NEO only in v1** (widen later; Estate graft), transfers nothing out, emits `Received(appId, asset, from, amount)` — fee attribution is the address itself, no memo discipline needed. **Two-ledger doctrine** (RMAA, worth stating verbatim): *the ACCOUNT is app-owned money; the ENGINE LEDGERS are user-owned money.* Refundable player balances stay in engine (appId,payer) credit ledgers with memo routing; the account never custodies user claims.

**Spend.** The account holds funds but decides nothing. Its only outbound path is `executeTransfer(asset, to, amount)` asserting `Runtime.CallingScriptHash == registry`. All policy lives in `PlatformRegistry.Treasury`, and every lane is role-bound:

- `spendToPayout(appId, asset, amount)` — app-admin witness; destination is **only** the registered payout address. There is **no auto-seeded payout**: a distinct payout must be installed through the 24h-timelocked `proposePayoutAddress/executePayoutAddress` pair before the lane works, so a compromised app-admin key cannot instantly point the treasury at itself. The per-app threshold bounds **cumulative** instant-lane outflow over a **rolling 24h window** (`spentInWindow + amount ≤ threshold`), not per call, so a burst of sub-threshold spends cannot drain past the threshold; larger single spends require the timelocked `proposeSpend/executeSpend` pair.
- `fundEnginePool(appId, amount)` — destination hard-bound to the app's registered engine hash, transferred with memo `appId:credit` so it lands in the engine's (appId)-scoped pool. This is treasury → reward pool in one call.
- Revenue split / `distributeRevenue` crank: **deferred** past phase 1 (no named consumer; it was RADE's largest speculative policy surface per both judges).
- The literal string `UInt160 recipient` appears nowhere; matching pins go into `FinancialTransferSafetyTest`. **RMAA's free-destination `Spend` is rejected outright** — it would have carved the first-ever exception into the fleet's strongest test-enforced invariant and been the highest-value drain target of any design.

**Governance & exit.**

- Two-tier per the audited PlatformGame grammar (§3 trust table). Platform admin has **zero** spend path over app accounts.
- **`OnAdminRotated` push** (Estate graft): registry-side `setAppAdmin` completion pushes the new admin into the shim, so the locally cached admin never drifts — closing the stale-escape-key flaw the judges found in RADE.
- **Shim upgrades need double consent:** new artifact versions affect future mints; existing accounts upgrade only via registry-orchestrated `update()` behind the platform timelock **and** the app's per-account consent flag (RADE graft) — closing Estate's fleet-repave / single-key rug vector.
- **`escapeExecute(asset, amount)`** — app-admin-witnessed direct exit, usable only after the registry has been globally paused ≥ the escape timelock, defaulting to 30 days to mirror `AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS` (`framework/utils/aa-account.ts:18`, bounds 7–90 days). This closes RMAA's fleet-freeze flaw (live-only authority, no hatch).
- **What the escape hatch does and does NOT counter (honesty correction).** `escapeExecute` counters registry **bricking / abandonment**, not registry **capture**. Its trigger is a ≥30-day *global pause* — the state an honest-but-stuck admin leaves behind (or that anyone can observe as "the registry went dark"). A **captured** platform-admin is not stuck: they would simply *not* pause, or un-pause, keeping the 30-day escape window shut, and then drain treasuries through the registry's own `executeTransfer` authority (see the registry-self-upgrade path in §10 obj 7/8). So the escape hatch is **not** the bound on a hostile captured admin. The real bound on a captured platform-admin is the **24h upgrade timelock plus on-chain visibility** of any malicious registry NEF push and the per-app consent/timelock on shim upgrades — a detection-and-react window, not a pre-emption. Stated plainly: a bricked registry can never *permanently* trap app treasuries (the credible-exit guarantee that drove the last defection); a captured registry is bounded by timelock + visibility, and this is the acknowledged registry-upgrade trade-off (§10 obj 7/8), not something the hatch closes.
- **Shim-upgrade TOCTOU now closed (harden-stage hardening).** The double-consent shim upgrade binds the app's consent to the **currently-active artifact version**, and each upgrade opens its own 24h timelock. This specifically closes the shim-artifact **TOCTOU** where a stale, version-agnostic consent could have been ridden by a later platform-activated artifact — consent now names a specific artifact and cannot be reused across a version swap.
- Witness-gated exits are immune to the **global registry pause** (the anchor invariant): engine `withdraw`, registry `withdrawCredit`, `spendToPayout`, and `escapeExecute` never consult the registry kill switch. `spendToPayout` does, however, deliberately respect the account's **local pause** — that flag is an app-admin tool, and a locally-paused account choosing not to route treasury out is fine. `escapeExecute` is the single **fully** pause-immune exit (immune to both the global and local pause), and is the credible-exit guarantee specifically when the registry is **bricked or abandoned** (not captured — see the honesty correction above).

### 4.2 Rejected alternatives (and why)

| Alternative | Why rejected |
|---|---|
| Shared UnifiedSmartWallet-V3 account ids as app identity | **Adopted as the default after joint implementation and runtime tests.** The Registry/AA registrar pair, app-admin ownership, core-scoped reverse index, and cross-repository address vector close the earlier integration gaps. Optional deployed shims remain available when a product needs separate treasury semantics. |
| Pure registry ledger entry (no minted contract) | Fails the hard requirement — no unique on-chain *address*; reintroduces memo discipline for every receiver; explorers/sponsors can't target the app. |
| Counterfactual funding of a pre-published optional-shim address | The tx.Sender hash semantics make the deployment prediction sender-dependent; funds at a never-minted shim are unrecoverable. Killed. Shared-AA addresses may be derived only after the Registry records a materialized `(core, accountId)` pair. |
| Free-destination `Spend(asset, amount, to)` gated by identity (RMAA) | Instant full-treasury drain on one compromised appAdmin key or one buggy allow-listed service; requires breaking the banned-`UInt160 recipient` fleet invariant. Role-bound lanes + timelocked payout address deliver the same capability with a bounded blast radius. |
| Extending live MiniAppFactory into the registry (Estate) | Requires in-place upgrade of a live consumed contract to bootstrap the spine, couples the factory's 3 consumers to registry churn, and its phase-1 admin-gated registration reproduces the measured non-adoption dynamic. Its *mechanisms* (artifact storage, hash-pin-by-test, pipeline lane) are adopted; its *host* is not. |

---

## 5. Scenario coverage matrix

| Scenario family | Where it lives in v2 | Status today (census) | v2 path |
|---|---|---|---|
| Stake → fair-resolve → payout (skill) — 11 of 34 contracts | PlatformGame v2 RewardGame module | 10-11 clones ~815 LOC each, >90% identical; curve-arrow unbound | **Cohort 1**: descriptor rows; rides the operational session kernel |
| Wager (commit/reveal, gacha, pot) — 6 contracts | PlatformGame existing modules (descriptor-lifted later) | CoinFlipV2/DiceGameV2 live-validated standalone, healthy | **Not forced.** Migrate only if descriptor economics offer them something; listed in the directory as lane-B residents |
| App identity / treasury / fee attribution / pool funding | PlatformRegistry + UnifiedSmartWallet; optional AppAccount shim | 77/77 directory rows now exist; shared-AA ABI is source-only and 0/77 are live-materialized | **The new spine**; zero-deploy identity by default, isolated treasury contract only on demand |
| Staking / delegation | PlatformAnchor | **Alive** — 5 apps, permissionless tenancy | Grandfathered engine row, zero rework; testnet-hash divergence reconciled in the directory |
| Token/NFT issuance, template deploys | MiniAppFactory | **Alive** — 3 apps | Grandfathered engine row, untouched |
| Credits / payments | MiniAppCredits + native tokens | Working zero-deploy exemplar (DB attribution) | Untouched; registry does not subsume it |
| Conditional release (escrow, pact, vault, timelock) — 4 contracts | Finance.Escrow + Social.Bond (phase 3) | Strong single-app instances (MilestoneEscrow audited) | Tenancy + release-condition axis, behind a named tenant |
| Social gifting (envelope/range-pool) | PlatformSocial.Envelope (exists) | Built; **no deployment record**; gas-lucky-pool writes disabled on ABI mismatch | Revival trigger = gas-lucky-pool cutover commitment |
| Tipping | Social.Tipping (phase 3) | TipJar live (dev-tipping) | Payee abstraction + fee bps |
| Notary / timestamping | Social.Notary (phase 3) | Local contract, event, framework surface, and Timestamp Proof dual path complete; no deployment or production binding | Deploy/register/verify first tenant before enabling the manifest binding |
| Vesting / streams / prefunded subscriptions | PlatformVesting (phase 3) | **Source/build/test accepted**; NeoPay remains live reference; no PlatformVesting deployment record | Local GAS/NEO credit + linear/cliff stream engine and guarded framework surface; deployment, Registry binding, funded lifecycle, and NeoPay migration remain gated |
| Conditional release / milestone escrow | PlatformEscrow (phase 3) | **Source/build/test accepted**; legacy MiniAppMilestoneEscrow remains the live reference; no PlatformEscrow deployment record | Native GAS/NEO credit + appId-scoped single-creator or bounded M-of-N milestone approval/claim/cancel/timeout recovery; guarded `app.platformEscrow`; deployment, Registry binding, funded lifecycle, and migration remain gated |
| DeFi lending / flash / capsule | PlatformFinance (= PlatformDeFi evolved) | Deployed-but-dead; self-loan/flashloan defected | (appId,payer) credit fix; live-oracle price + interest accrual are named backlog |
| Randomness products (raffle/lottery) | RandomnessLane engine (phase 4) | TarotVrf pattern compiled, not deployed; VRF signer ops not proven | **Gated on Morpheus VRF ops being demonstrably live** |
| Governance / voting | Tenant voting engine (phase 4, last) | CouncilGovernance live, source external | Medium re-implementation; deployed ABI as compatibility reference |
| Attestation / SBT, ticketing, QF, multisig | Standalone (lane B) | Strong audited single instances | Parameterization deferred; extension grammar is the path when a consumer appears |
| AMM, NFT marketplace, prediction markets, pull subscriptions, DID registry, NNS | **Deliberately not covered** | True gaps / external | Named non-goals (§1) with per-item reasons |

---

## 6. Extension model — how scenario N+1 lands without redesign

1. **New engine contract** built on `MiniAppEngineBase` (registration push, descriptor validation, AppKey storage, credit+liability ledger, locks, pause consult), compiled through the standard lane, shipped with the three-layer test suite (§8).
2. **One timelocked `registerEngine(engineId, hash, schemaVersion)`** row. The registry code never changes to add a domain. A defective engine is `retireEngine`d without touching any app's identity or treasury.
3. **New per-app parameters = new descriptor keys** under the engine's namespace, validated engine-side. No registry schema change.
4. **Framework side:** one config-injected surface per engine on the `app.credits` exemplar (host injects `{registryHash, engineHash}`; the surface auto-threads `appId` + `scriptHash` exactly as `credits.ts` auto-targets `config.contractHash`), with `manifest.platformBindings` providing composable module hashes while legacy `ContractBinding.mode: 'shared'` bindings remain compatible. `defineMiniApp` resolves these hashes into the corresponding framework options before `MiniAppRoot` constructs the app context; the primary contract slot therefore remains available for app-owned logic. The wallet SDK resolves a typed custom `contract.hash` before legacy registry fallback and intentionally leaves `platformBindings` additive rather than routing it through `getContractAddress()`.
5. **Named first consumer before any engine code lands.** The grammar (registration / consumed descriptor / scoped storage / shared lifecycle / central trust root / two-tier governance — the six moves the census extracted) is the contract; the consumer is the proof.

This replaces Estate-v2's weak leg (every new scenario = another in-place upgrade of a live money contract behind the platform admin) with RMAA's plug-in isolation, while keeping engine addition behind the platform timelock — an accepted, visible bottleneck.

---

## 7. Migration plan

### Anti-graveyard rules (structural, from the measured failure causes)

1. No engine work ships without a named first tenant whose binding cutover lands in the same milestone.
2. Verbatim ABI fidelity to the names the framework hardcodes — client migration is config + appId threading, never a rewrite.
3. The operational dependency is proven per cohort **before** migration (RewardGame rides the live session kernel; anything VRF-signer-dependent waits for demonstrated ops).
4. Exits never close: old contracts' witness-gated `Withdraw` lanes stay live forever; `escapeExecute` bounds registry risk; per-app pause and descriptor autonomy answer the recorded upgrade-autonomy complaint.

### Cohorts

**Cohort 0 — estate truth + shared identities (zero migration risk).** All **77 apps** are now registered and active in the testnet directory. After reviewed Registry/AA upgrades and reciprocal timelocked configuration, `materialize-abstract-accounts` must first run dry and prove 77 unique `(core, accountId)` pairs, then any write is separately approved. No per-app deployment is required. First RewardGame tenant remains **curve-arrow**, followed by the unbound guest games. PlatformAnchor and MiniAppFactory stay grandfathered as engine rows under their live hashes.

**Cohort 1 — the 9 TEE clones, one at a time.** Per game: apply the descriptor, stop new standalone starts, let active games settle/expire, withdraw the old free pool to an explicitly reviewed destination (shared AA or optional treasury shim), seed the shared engine pool, flip `neo-manifest.json` to `ContractBinding.mode='shared'`, regenerate the registry, and run the app's live validator. **Player credit dust is never force-migrated**: old `Withdraw` stays live. Payoff: ~7,300 duplicated lines become descriptor rows.

**Cohort 2 — JumpRush + SheepSolitaire**, retiring the bespoke secp256r1 generation onto the same kernel after the clones prove out.

**Cohort 3+ — Finance/Social evolutions**, each behind its named tenant (gas-lucky-pool is the trigger-ready Social candidate — its writes are disabled today *precisely because* of a stale binding). The **wager quartet is explicitly not forced** (§5).

### PlatformDeFi v1.2 credit recovery gate

1. Snapshot the deployed contract, native NEO/GAS balances, all product rows, and every storage entry under legacy credit prefixes `0x14` and `0x15`.
2. Freeze new deposits, simulate the exact v1.2 update, and require automatic pause plus `SnapshotRequired`; reconcile the supplied payer arrays and snapshot hash against the complete public storage enumeration before initialization.
3. Require initialized legacy row counts and liabilities to equal the snapshot exactly. If native backing is below those totals, the deficit needs a separately approved funding or loss-allocation decision; activation, withdrawal, and unpause must remain closed until full backing.
4. Simulate the exact top-up, activation, and every payer-witnessed withdrawal. Require all legacy credit rows and liabilities to reach zero before recovery completes and normal unpause succeeds.
5. Prefer deploying v1.2 at a new hash while bindings are zero. Register and bind a first tenant only after artifact equality, exact memo routing, cross-tenant isolation, pause-immune recovery, native-balance-versus-liability solvency, and funded lending/capsule/flash lifecycles pass.
6. Never infer migration safety from unchanged prefix bytes, an update simulation that HALTs, or the absence of current framework bindings.

### ABI stability policy

- Engine ABIs are **additive-only** post-registration; `schemaVersion` in the engine row records compatibility; breaking changes require a new engine row + opt-in re-attachment, never in-place mutation of a consumed method.
- Framework method-map overrides (`config.methods`, already supported by reward-game-sdk) are the escape valve for any per-app divergence.
- The PlatformGame in-place update that adds RewardGame is additive partials only; existing module ABIs are untouched and pinned by test.

### Tooling

Registration/deploy Go scripts reuse the pipeline idioms verbatim: `I_UNDERSTAND_THIS_WRITES_CHAIN` confirm phrase, network-magic checks (testnet 894710606 / mainnet 860833102), predicted-hash via `state.CreateContractHash`, idempotent skip, post-action JSON reports — plus a new `register_apps_on_platform_registry.go` roster. All chain writes are the user's.

---

## 8. Security & conventions compliance (the test-enforced DoD)

Every new/changed contract satisfies the census lane-1 checklist, with the specific rows named:

- [ ] Near-empty csproj relying on `contracts/Directory.Build.props` (nccs 3.9.1, net10.0); no `*.cs` wildcard includes (`ContractProjectConventionsTest`).
- [ ] Every source file ≤300 lines; no placeholder/stub/"reserved for future" markers; no stray "weight" terminology.
- [ ] Admin-gated `update` in the compiled ABI + `ContractManagement.Update` in source; **no `Destroy`**; PlatformRegistry and AppAccount added to `ContractUpdateCoverageTest` InlineData (platform contracts are individually enumerated).
- [ ] Narrow `ContractPermission` (named methods, never `(*,*)`).
- [ ] Money paths: PlatformRegistry + AppAccount registered in `OnNep17PaymentConventionTests.MoneyContracts()`; callbacks validate+credit-only with zero outbound transfers; `ReviewedTransferExceptions` **stays empty** — no design in v2 needs an exception.
- [ ] `FinancialTransferSafetyTest` extensions: assert-wrapped transfers; banned `UInt160 recipient` across PlatformRegistry/AppAccount partials; role-bound destination pins for `spendToPayout`/`fundEnginePool`/`executeTransfer`; escape-hatch ordering pins.
- [ ] Anchor invariants extended: user/app-admin exits pause-immune; platform admin has no path to app or user funds ("admin cannot harvest"); per-app accounting isolation.
- [ ] **Three test layers per contract**: (1) TestEngine behavioral suite against nccs-compiled NEFs (register → mint via real in-engine `ContractManagement.Deploy` → **measured-hash test** → handshake → fund → spend-policy matrix: role-bound lanes allowed / stranger denied / pause-immune exits / escape-hatch timing; RewardGame full lifecycle through `GameOracleMockFixture`); (2) source-security pin suites for paths TestEngine cannot exercise (FAULTing NEP-17 callbacks hang the host — established idiom); (3) model-based invariant suites (randomized 500-step register/fund/start/settle/withdraw sequences asserting per-app conservation and the mandatory liability counter).
- [ ] Shared `CreateContractHash` **test-vector JSON** consumed by both xunit and a new vitest for `deriveAppAccountHash` in `framework/utils/aa-account.ts` — C# / TestEngine / TS triple agreement, with the sender component *measured*, not assumed.
- [ ] Manifest-splice fuzz test (two-half template ⊕ appId) so a malformed template can never brick minting.
- [ ] `npm run test:contracts:full` stays green through every incremental landing (everything in phase 1 is additive).

Residual risks, stated honestly: descriptor-driven economics turn config bugs into exploits (bounded by engine-side range validation + invariant tests — still the largest new attack surface); the registry is a systemic pause point AND, because it holds `executeTransfer` authority over every AppAccount, a systemic **capture** point — bounded by no pooled user funds in the registry itself, per-app pause independence, and the escape hatch for **bricking/abandonment**, but for **capture** bounded only by the 24h registry-upgrade timelock + visibility (the escape hatch does not counter a captured admin — see §4 and §10 obj 7/8); oracle *operations* remain the adoption king-maker — the design chooses the operational dependency and keeps exits open, but cannot fix ops. S11 now separates `invoke:platform-registry`, `invoke:platform-game`, `invoke:platform-social`, `invoke:platform-anchor`, `invoke:platform-defi`, and `invoke:platform-factory` from `invoke:primary`; this prevents a host-granted module capability from authorizing sibling targets, but it is still client/host policy rather than an on-chain authorization boundary. Witness checks and `RequireRegistered`/tenant checks remain authoritative.

---

## 9. Phased delivery

**Phase 1 — landable in this repo now (source + tests only, zero chain writes, no ABI changes to anything existing):**
(a) `contracts/platform/PlatformRegistry/` (7 partials); (b) `contracts/platform/AppAccount/` (2 partials); (c) `contracts/MiniApp.DevPack/MiniAppEngineBase.cs`; (d) `PlatformGame.RewardGame*.cs` additive partials + descriptor consumption; (e) `framework/utils/aa-account.ts` gains `deriveAppAccountHash` + vitest vectors; (f) the full §8 test complement, including the hash-sender **measurement test as the first commit** of the account workstream. Deliberately **excluded** from phase 1 (both judges' breadth objection): revenue-split/`distributeRevenue`, Streams/Tipping/Notary, RandomnessLane, any Finance/Social change.

**Phase 2 — wiring + first chain writes (user-side):** framework `app.platformGame` surface (app.credits pattern), appId auto-threading, `ContractBinding.mode='shared'` resolver wiring; Go registration/deploy tooling; **testnet deployment by the user**; cohort 0 (directory registration of all 77 apps, curve-arrow + unbound guest games live) and cohort 1 begins (one clone at a time, drain protocol, live-validate green).

**Phase 3:** remaining clones + JumpRush/SheepSolitaire; Finance/Social v2 evolutions (Social fee accumulators, Tipping, Notary, Streams, Escrow axis; Social `(appId,payer)` unification is source-complete) — each gated on its named tenant; treasury revenue-split lands here **if** a consumer names it.

**Phase 4 (demand-gated):** RandomnessLane (gated on demonstrated VRF signer ops), tenant voting engine, wager-quartet migration only if wanted, arbitrary-NEP-17 accept on AppAccount, USW-agent session-operator slot.

**Deferred indefinitely:** AMM, NFT marketplace, prediction markets, pull subscriptions, platform DID registry.

---

## 10. Resolved objections

Every fatal flaw raised by either judge, and its disposition in this design:

| # | Objection (judge, target) | Resolution |
|---|---|---|
| 1 | **Counterfactual-funding stranded funds**: predicted address published at registration; tx.Sender-derived deploy hash lands elsewhere; sponsor funds permanently stranded (J1+J2, RADE) | Counterfactual funding **removed**. No address published before materialization; registry row records the *actual* deployed hash as address-of-record; prediction helpers are advisory and pinned to an in-engine measurement test written before any prediction code; minting routed through the fixed pipeline sender so off-chain precomputation still holds. |
| 2 | **On-chain `CreateContractHash` preimage reconstruction is built on the wrong sender component**; `PredictAccountHash`/`deployer==registry` assertions don't hold on real Neo semantics (J1+J2, RADE+RMAA) | On-chain preimage reconstruction **dropped** from the design. Sender semantics treated as a hypothesis pinned by the phase-1 TestEngine measurement; `_deploy` deployer-assert replaced with a post-deploy registry↔account bind handshake. The design is correct under either resolution of the hypothesis. |
| 3 | **Free-destination `Spend` = instant treasury drain + first-ever `ReviewedTransferExceptions` carve-out** (J1+J2, RMAA) | Not adopted. All spend lanes role-bound (timelocked payout address, engine-hash-bound pool funding); `UInt160 recipient` remains banned fleet-wide; `ReviewedTransferExceptions` stays empty. |
| 4 | **Registry brick freezes every treasury fleet-wide, no escape hatch** (live-only authority) (J1+J2, RMAA) | AppAccount caches appId/registry/appAdmin locally (push-refreshed via `OnAdminRotated`); `escapeExecute` opens after ≥30-day global pause (mirroring `AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS`); all exits pause-immune; the registry holds no pooled user funds. **Scope (honesty correction, see §4):** this counters registry **bricking / abandonment** — the 30-day *global pause* an honest-but-stuck admin leaves — not registry **capture**. A hostile captured admin simply never pauses (or un-pauses), so the hatch never opens; that case is bounded by the 24h upgrade timelock + visibility, per obj 7/8, not by the hatch. |
| 5 | **Stale shim admin hands the escape lane to an old/compromised key** (J1, RADE) | `OnAdminRotated` push (Estate graft): registry-side rotation completion updates the shim cache atomically; a source pin asserts the push exists in `setAppAdmin`'s execute path. |
| 6 | **Admin-bottlenecked registration reproduces the measured non-adoption dynamic; "permissionless later" is the promise that never shipped** (J1+J2, Estate) | Permissionless fee-paid `registerApp` is **phase-1 code**, generalizing the only registration model with live adopters (PlatformAnchor M-11), alongside the pipeline lane. Lite tier (~1 GAS) removes the cost cliff for the 25 no-contract apps. |
| 7 | **Factory/registry-gated fleet shim `Update` = single-key rug over all treasuries; platform recovery-rotation = timelocked seizure path** (J1+J2, Estate) | Shim upgrades require platform timelock **and** the app's version-bound per-app consent flag (the harden-stage fix closes the stale-consent / shim-artifact TOCTOU — consent names a specific active artifact and cannot ride a later version swap); platform admin has zero spend path over app accounts (test-pinned); recovery rotation is retained only as the timelocked, event-emitting `setAppAdmin` pair. **Honesty correction — the registry-self-upgrade drain is NOT closed by the escape hatch.** A *captured* platform-admin can push a malicious **registry** NEF (24h upgrade timelock, hash preserved) and, once it lands, drain every AppAccount through the registry's own `executeTransfer` authority — and because the attacker controls the pause, they keep the 30-day escape window shut, so `escapeExecute` cannot pre-empt it. This is the acknowledged **registry-upgrade trade-off**: the real bound on a captured admin is the **24h registry-upgrade timelock + on-chain visibility** of the malicious NEF (a detect-and-react window for app admins to `spendToPayout`/exit before it matures), **not** the escape hatch. Documented as an accepted, visible trade-off, stated without overclaiming the hatch. |
| 8 | **Hull-upgrade extensibility: every new scenario re-runs a risky in-place upgrade of a live money contract behind an admin bottleneck** (J1+J2, Estate) | The engine table (§6): scenario N+1 = new independent contract + one timelocked `registerEngine` row; defective engines retire in isolation. The only in-place upgrade in the plan is the one-time RewardGame addition to the zero-user PlatformGame hull. |
| 9 | **New engine beside the dead PlatformGame grows the graveyard** (J2, RMAA) | RewardGame lands **on** the deployed PlatformGame hull via its purpose-built timelocked Update — the estate shrinks by ~7,300 LOC instead of growing by one engine. |
| 10 | **Phase-1 breadth / treasury-policy blast radius** (J1+J2, RADE) | Phase 1 trimmed to registry + account + RewardGame + DevPack base; revenue-split crank, Streams/Tipping/Notary, and all Finance/Social work deferred behind named consumers. Every phase-1 artifact is additive; the suite stays green per landing. |
| 11 | **Estate text truncated / risk register unverifiable** (J1+J2, Estate) | Moot — this document is the complete register; Estate's visible mechanisms are incorporated where they won and its gaps are filled by the grafts above. |
| 12 | **Estate-truth honesty gaps: PlatformSocial never provably deployed; two divergent Anchor testnet hashes; 8 stale roster rows; generated-TS drift** (both judges' inputs) | The registry directory is the canonical ledger, and cohort 0 includes the reconciliation as a deliverable, not a given. |

---

## 11. Open questions for the product owner

1. **Optional treasury-shim policy.** Shared AA is now the default. Which named apps, if any, actually need the ~10 GAS platform fee plus separate `ContractManagement.Deploy` system fee for an isolated AppAccount treasury?
2. **Shared-AA testnet sequencing.** The current live AA core predates `proposeUpdate`; its bootstrap to the local artifact is therefore a legacy direct-admin update, even though the candidate makes every subsequent AA upgrade seven-day timelocked. Treat that one-time transition as a heightened review gate. The tracked historical manifest is semantically equivalent to the live ABI. The candidate moves `VerifyScopeTarget` from `0x12` to `0x1C` but explicitly proves legacy-key read fallback, active-key writes, and old-key cleanup; stored-record layouts are unchanged. The historical NEF checksum does not match the live checksum, so exact deployed-source provenance is unknown and compatibility remains conditional rather than proven exact. The fail-closed order is: review the exact candidate AA artifact/admin and direct-update simulation; upgrade UnifiedSmartWallet and verify its exact resulting artifact/ABI; upgrade PlatformRegistry while `abstractAccountCore == 0`; propose and confirm Registry as the AA registrar; only then propose and set the AA core in Registry; rerun the read-only reciprocal-state preflight; run the full 77-app dry-run; then request separate approval for any write run. Never rotate the AA registrar away from Registry until the Registry core has first been timelocked back to zero.
3. **Wager quartet stance.** CoinFlipV2/DiceGameV2 are live-validated and healthy standalone. Confirm: directory-listed lane-B residents indefinitely, no migration pressure?
4. **Escape-hatch window.** 30 days (mirroring the AA constant, bounds 7–90) — right default for app treasuries, or shorter given these are business funds rather than user recovery?
5. **MiniAppCredits.** It remains payer-global with DB attribution and is "implemented, not yet deployed" per its own docs. Deploy it as-is under the directory, or fold its buy/settle lanes into the registry credit model later?
6. **Resolved — per-engine permission vocabulary.** S11 now enforces distinct `invoke:platform-*` grants for Registry, Game, Social, Anchor, DeFi, and Factory writes; `invoke:primary` authorizes only the standalone primary-contract lane. Keep the on-chain witness/tenant checks as the real security boundary.
7. **Fleet `--checked`.** The tarot lane compiles with `--checked` and pins nccs 3.9.1; `contracts/build.sh` does not. Make `--checked` fleet-wide in the same pass?
8. **Mainnet sequencing.** All phase-2+ chain writes are yours. Testnet-only until cohort 1 fully proves out, with mainnet PlatformGame update as a separate explicitly-approved milestone — confirm?
9. **PlatformSocial's fate.** No deployment record, ABI mismatched with its one candidate consumer. Revive on the gas-lucky-pool trigger (this plan's default) or retire the Vault module and keep only Envelope/Trust?
