# Joint Platform Contract Library — Three-Repo Refactor, Audit, and Testnet Verification Design

Date: 2026-07-18
Status: Approved by user (2026-07-18), amended by the shared-AA architecture decision (2026-07-23)
Scope: `neo-miniapps-platform` (this repo), `neo-morpheus-oracle`, `neo-abstract-account` (sibling checkouts under `/Users/jinghuiliao/git/r3e/`)

## 1. Objective

Systematically refactor the platform contract library so that **system/platform contracts provide the vast majority of on-chain functionality**. User miniapps/mini-games deploy nothing, or only a thin DevPack shim, and implement their features on top of the platform contract library. The library must be general, powerful, extensible, and user-friendly enough to cover mainstream blockchain scenarios.

Supporting objectives:

- Clean up and optimize folder structure and overall architecture in all three repos.
- The platform creates a **unique virtual account address per registered miniapp/game** in one shared UnifiedSmartWallet core. A separately deployed `AppAccount` remains optional for apps that explicitly need an isolated treasury shim.
- Abstract the framework to deduplicate miniapp/game code; provide platform-level interfaces and modules so apps stop re-implementing the same functionality.
- Verify miniapp logic, contracts, correctness, and professionalism; verify UI and optimize UX.
- Joint audit, joint testing, joint verification, and joint refactoring across the three repos.
- Deploy and verify everything on NEO testnet using the operator-provided testnet WIF account.

## 2. Current State (from joint exploration, 2026-07-17/18)

### neo-miniapps-platform

- "MiniApp-OS v2": 77 miniapp frontends, Next.js host shell + admin console, 42 Supabase edge functions, on-chain estate of C# contracts (neo-devpack-dotnet, nccs 3.9.1, .NET 10).
- The target architecture is documented in `docs/platform-contract-library-v2.md` ("Registry-Anchored Engine Estate"). The live testnet Registry at `0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b` has 77/77 active directory rows but predates the shared-AA ABI; it therefore requires a reviewed upgrade before any shared account can be materialized.
- `contracts/platform/`: PlatformRegistry (~1.4k LOC), AppAccount (~275 LOC), PlatformGame (3.5k+ LOC, v2 RewardGame partials uncommitted), PlatformAnchor (live, 5 apps), MiniAppFactory (live, 3 apps), PlatformDeFi (2.6k LOC, zero bindings), PlatformSocial (1.8k LOC, never deployed).
- 34 legacy `MiniApp*` contracts (~20.7k LOC) pending absorption; a clone family of ~11 TEE skill-game contracts, >90% identical (~7k duplicated LOC).
- Three SDK generations coexist: `framework/` (new), `apps/shared/services` + `services/os/*Proxy` (older), `platform/sdk` (oldest).
- Working tree mid-refactor: ~70 modified/uncommitted v2 files (RewardGame partials, MiniAppEngineBase.cs, registry-surface.ts, platform-game-surface.ts, deploy scripts).
- Tests: 66 C# xunit files (505 methods), framework vitest 553 PASS, apps/shared vitest 4424 PASS, host-app jest, Playwright e2e last run FAILED.
- Deploy: Go scripts (`//go:build scripts`), dry-run by default, `CONFIRM_*` gate, WIFs via env only (`NEO_TESTNET_WIF`).

### neo-morpheus-oracle

- MorpheusOracle contract IS the MiniApp OS kernel: miniapp registration, module registration, capability grants, request routing, inbox delivery, fee credits, generic app state.
- Known kernel upgrade debt (source-fixed, not deployed): OR-D-03 callback reverse-mapping hijack, rich 8-arg `onMiniAppResult` dispatch, ExpireStaleRequest inbox gap. Deployed testnet kernel `0xf54d8584…` lacks these; miniapps platform carries `deploy_private_kernel.go` workaround.
- 12 JS game engines in `workers/nitro-worker/src/game/engines/` explicitly duplicated from miniapps platform app logic.
- `confidential-envelope.js` vendored verbatim into the other two repos with SHA-256 drift guards; not exported in package.json exports map.
- Mature live testnet boundary suites (`examples/scripts/test-n3-*.mjs`), cross-repo workspace validation scripts.
- On side branch `chore/solc-0.8.35-upgrade`, 71 dirty files; `scripts/` sprawl (109 files); committed `.env`, `private-backups/`, `.DS_Store`.

### neo-abstract-account

- UnifiedSmartWalletV3: global-singleton AA core (no per-user deployment), verifier plugins (Web3Auth, TEE, WebAuthn, SessionKey, MultiSig, Subscription, NeoNative, ZkLogin), hook plugins (DailyLimit, Whitelist, TokenRestricted, MultiHook, NeoDIDCredential), AAPaymaster, AAAddressMarket, MorpheusSocialRecoveryVerifier.
- Every contract is a platform singleton; zero per-app contracts. `RegisterAccounts` batch API documents anchor-derived agent accounts — an existing seam for per-app account derivation.
- Fresh-clone breakage: `scripts/dotnet_env.sh` untracked but sourced by `contracts/compile.sh` and `verify_repo.sh`; tracked `sdk/js/src/index.js` requires untracked `shared/registrationAccountId.mjs`.
- 33 junk directories with literal newlines in names; `.gitignore` polluted with multi-line garbage entries; LaTeX build junk in docs; `market-deployment-results.json` committed at root.
- Tests: MSTest 157 methods, SDK unit tests 78/78 PASS, live testnet validators.
- Testnet AA core: `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2`; mainnet: `0x0268a387913b250166ddec032b03332690a1ef78`.

## 3. Target Architecture

### 3.1 Platform Contract Library (this repo, `contracts/platform/`)

The registry-anchored engine estate, extended:

- **PlatformRegistry** (deployed, local upgrade pending) — the spine: custom-id permissionless fee-paid `registerApp`, a platform-reserved `miniapp-*` namespace served only by `registerAppByPlatform`, engine registry, directory reads, role-bound treasury lanes, 24h-timelocked governance, and a timelocked `abstractAccountCore`. Once configured, registration calls `computePlatformAccountId` and `registerPlatformAccount` so each app receives a unique shared-AA identity automatically; old rows use idempotent `materializeAbstractAccount`.
- **UnifiedSmartWallet V3** (AA repo, shared singleton) — the default per-app abstract-account host. The PlatformRegistry is a timelocked registrar only; each app's `appAdmin` is the backup owner and retains verifier/hook control. The account ID is domain-separated by Registry hash + appId and maps to a deterministic Neo verification script/address without deploying a per-app contract.
- **AppAccount** (optional deployed treasury shim) — retained for isolated treasury custody and escape semantics only. It is not the default registration path and is never required for zero-deploy miniapps.
- **MiniAppEngineBase** — canonical engine base (uncommitted, to finalize): AppKey kit, (appId, payer) ledger with liability counter, 3 reentrancy-lock granularities, `activateApp` / `validateAndApplyDescriptor`.
- **Engine estate** (multi-tenant, apps register appId + descriptor instead of deploying):
  - PlatformGame — Countdown/CoinFlip/Gacha/Dice + RewardGame (kernel-settled); absorbs the 11-contract TEE skill-game clone family and other legacy game contracts.
  - PlatformDeFi — lending/flashloan/capsule/credit; extend per gap analysis (staking, swap routing where sensible).
  - PlatformSocial — envelope/range-pool/trust/vault; first deployment.
  - Gap-driven additions (Phase 3): token factory (NEP-17), NFT factory (NEP-11), governance, per mainstream-scenario coverage analysis.
- **Morpheus kernel** (morpheus repo) — the off-chain↔on-chain bridge: oracle/TEE/VRF/compute/NeoDID. Fold in the pending kernel upgrade (OR-D-03 fix, 8-arg `onMiniAppResult`, ExpireStaleRequest inbox) so the private-kernel workaround can retire.
- **USW-V3 AA stack** (AA repo) — shared user/app identities, paymaster sponsorship, verifiers/hooks, plus a timelocked platform registrar extension. The registrar cannot choose plugins or spend; it can only create the deterministic account with the app admin as owner.

### 3.2 Why shared USW-V3 accounts are the default

- A credential-free dry-run of the old per-app deploy path simulated 77 successful mints but estimated `771.29012379` GAS system fee plus about `23.10000000` GAS network fees. Requiring roughly 794.39 GAS and 77 deployments contradicts the zero-deploy objective.
- One audited core can host every app while preserving a unique account ID, verification script, script hash, and Neo address per app.
- Registry and AA governance are both timelocked. `Runtime.CallingScriptHash == registrar` prevents direct squatting, while `appAdmin` ownership prevents the platform from controlling app accounts. Registry core activation and disable share the 24-hour timelock; disabling preserves existing identities and returns new registrations to directory-only mode.
- The SDK, AA frontend, and miniapps framework now share a fixed byte-order vector: display-order `UInt160` values are reversed only while emitting raw NeoVM script bytes.
- The old `AppAccount` design remains useful as an explicitly requested treasury-isolation lane; it no longer defines registration completeness.

### 3.3 Framework unification (this repo)

- `framework/` (`@neo/miniapp-framework`) becomes the ONLY app-facing SDK: chain/funds/oracle/credits/permissions/aa/game surfaces + new `registry-surface.ts` (read-only registry directory) and `platform-game-surface.ts` (auto-threads appId into engine calls).
- Archive `platform/sdk` (oldest) and the `apps/shared/services` + `services/os/*Proxy` layer (older) after consumers migrate.
- Shared game logic for TEE engines: single source in this repo consumed both by apps and by the morpheus nitro-worker (replacing the 12 duplicated JS ports).

### 3.4 Cross-repo integration contract

- Morpheus repo remains the source of truth for network registries; exports via `export-public-*.mjs`; consumers regenerate `generated-morpheus-{registry,runtime-catalog,signer-registry}.ts` (miniapps) and `generatedMorpheus*.js` (AA frontend); drift guarded by tests and `verify_cross_repo_testnet.sh`.
- `confidential-envelope` stays single-source in morpheus `packages/shared` with SHA-256-pinned vendored copies; add it to the package exports map so consumers can import instead of vendoring (long-term).
- Contract hash references flow only through the generated registries; no hardcoded hashes in app code.

## 4. Folder / Architecture Cleanup

### neo-miniapps-platform

- `contracts/`: platform library in `contracts/platform/`; legacy `MiniApp*` moved under `contracts/legacy/` during absorption, deleted as each family migrates; remove committed `contracts/build/*.nef` + manifests from git (gitignore + CI artifact generation); fix `deploy_all.sh` stale roster or delete it.
- Resolve divergent PlatformAnchor testnet hashes and stale census rows (update `docs/archive/claudedocs/contract-estate-census-2026-07-16.md` after re-verification).
- Consolidate docs: `docs/` canonical; claudedocs archived into `docs/archive/claudedocs/` (done 2026-07-18); root strays consolidated (done 2026-07-18: `design-prototypes/` → `docs/prototypes/`, `.impeccable.md` → `docs/design-context-impeccable.md`, tarot `design-qa.md` → `docs/reports/design-qa-tarot-2026-07-10.md`; zhuada-e keeps its app-local `design-qa.md` — release-audit 59/59 green).
- Remove committed tsbuildinfo; align package-manager story (done 2026-07-18: **npm everywhere** — 66 app manifests rewritten from pnpm `catalog:` protocol to concrete installed versions [typescript ^5.9.3, vite ^7.3.6, sass ^1.98.0, terser ^5.44.1, @noble/curves ^1.2.0, @noble/hashes ^1.8.0]; stale `apps/shared/pnpm-lock.yaml` deleted; no pnpm-workspace.yaml ever existed, so catalog refs were broken metadata; builds verified across snake-bounty/sudoku/neo-convert/neo-multisig/memorial-shrine).
- Delete stray `platform/pages/api/activity/` duplication.

### neo-abstract-account

- Delete the 33 newline-junk directories; clean the multi-line garbage entries from `.gitignore`.
- Fix fresh-clone breakage: commit `scripts/dotnet_env.sh` (or inline it) and `shared/registrationAccountId.mjs`.
- Remove `market-deployment-results.json` from root (move to docs/reports), LaTeX build junk, stale docs (TESTNET_DEPLOYMENT.md, ACCOUNT_DISCOVERY.md) or update them.
- Consolidate the three overlapping validation runners; resolve root `verifiers/` vs `contracts/verifiers/`.

### neo-morpheus-oracle

- Land the solc-0.8.35-upgrade branch state deliberately (71 dirty files): commit or stash with clear messages.
- Replace the 12 duplicated JS game engines with the shared game-logic source (import/generate from miniapps platform).
- Export `confidential-envelope.js` from `packages/shared` package.json exports map.
- Tidy `scripts/` (109 files) into subdirs by concern; remove committed `.env` (verify contents first), `private-backups/`, `.DS_Store`, root `_ssm_run.mjs`.
- Dedup docs: `docs/` vs `apps/web/docs/` vs `claudedocs/`.

## 5. Verification Strategy

### Contract correctness (all three repos)

- Run existing suites as baseline gates: miniapps xunit (505 methods), AA MSTest (157), morpheus xunit (16 files) + Foundry.
- Joint audit focus areas: PlatformRegistry treasury lanes + timelocks, AppAccount escape hatch, RewardGame settle path, Morpheus kernel callback routing (OR-D-03), AA relay key handling (`frontend/api/relay-transaction.js`), fulfillment-digest reimplementation in `deploy_private_kernel.go`, edge `_shared` auth/service-role handling.
- Model-based invariant suites already exist for PlatformRegistry/Anchor/RewardGame — extend to new engines as added.

### Cross-repo consistency

- `test/integration/cross_repo_hash_consistency.test.mjs`, `test/fuzz/fuzz_cross_repo.mjs`, registry sync drift guards — must stay green after every registry/catalog regeneration.

### Testnet live verification (operator WIF)

- Account: operator-provided testnet WIF, supplied via `NEO_TESTNET_WIF` env only; never committed; chain writes require `CONFIRM_*=I_UNDERSTAND_THIS_WRITES_CHAIN`.
- The live UnifiedSmartWallet predates `proposeUpdate`, so its bootstrap to the candidate is a one-time legacy direct-admin update. Review that exact candidate artifact, administrator domain, and HALT simulation before any authorization; the candidate makes later AA upgrades seven-day timelocked. The tracked historical manifest is a semantic ABI/storage proxy only because its NEF checksum differs from live, so exact deployed-source provenance remains unknown and compatibility is conditional. After the AA update and exact resulting ABI verification, upgrade PlatformRegistry with its AA pointer still zero. Confirm Registry as the AA registrar before proposing the Registry core pointer. Rerun the reciprocal-state preflight before `materialize-abstract-accounts`. Any write remains separately approval-gated. The expensive `materialize-accounts` action is reserved for optional treasury shims.
- Deploy/upgrade: PlatformGame v2, PlatformSocial (first deploy), PlatformDeFi bindings, kernel upgrade path (private kernel or coordinated shared-kernel upgrade), AA plugin set as needed.
- Run live suites: `verify_cross_repo_testnet.sh`, `run_full_live_smoke.sh`, morpheus `test-n3-*` boundary suites, AA `run_testnet_validation_suite.sh`, AA+paymaster+relay live paths.

### Miniapp logic / UI / UX

- Per-app logic: framework + apps/shared vitest (already green), contract-engine behavioral tests per migrated family.
- UI: fix and run Playwright e2e (last run failed), design-system audits (`scripts/audit-miniapp-*.mjs`, a11y audit), then UX polish pass driven by audit findings.

## 6. Phased Roadmap

- **Phase 0 — Stabilize baselines.** Commit/organize uncommitted work in all three repos; fix AA fresh-clone breakage; delete junk dirs; get all unit/contract suites green; record baseline.
- **Phase 1 — Joint audit.** Security + correctness + duplication census across the three repos; produce `docs/reports/joint-audit-2026-07.md` with findings ranked and mapped to refactor actions.
- **Phase 2 — Testnet baseline.** Review and execute the Registry/AA upgrades and reciprocal timelocked configuration, materialize shared app identities, run all live verification suites, and fix what fails.
- **Phase 3 — Library expansion.** Finalize MiniAppEngineBase + RewardGame; absorb the TEE clone family into PlatformGame; harden/deploy DeFi + Social; gap analysis for token/NFT/governance engines; morpheus kernel upgrade.
- **Phase 4 — Framework dedup + folder cleanup.** Single SDK; shared game-logic source consumed by nitro-worker; folder cleanups per §4.
- **Phase 5 — Miniapp migration cohorts.** Cohort-0 has 77/77 active directory rows; next materialize their shared-AA identities, then continue family-by-family engine migration with per-family verification.
- **Phase 6 — UI/UX verification.** Playwright green; design-system + a11y audits; UX optimization pass.
- **Phase 7 — Final joint verification + docs.** Full live smoke across three repos; update architecture docs and census.

Each phase produces verifiable artifacts (test runs, deployment records, audit report, migration ledger).

## 7. Risks and Mitigations

- **Captured-admin / key risk**: timelocked two-tier governance on PlatformRegistry; env-only WIF handling; gitleaks; dry-run-first deploy tooling.
- **Mid-flight testnet state**: live Registry bytecode lacks the shared-AA ABI and 0/77 shared identities are materialized. Upgrade/configuration sequencing and a dry-run report are mandatory before any write.
- **Kernel upgrade coordination**: shared testnet kernel is admin-key-locked; fallback is the private-kernel path already built (`deploy_private_kernel.go`); decision recorded in Phase 3.
- **Scope size (77 apps)**: migration is cohort-based; framework ABI preserved verbatim so apps migrate without rewrites.
- **Uncommitted work loss**: Phase 0 commits/stashes everything deliberately before refactoring begins.

## 8. Out of Scope (this program)

- Mainnet deployments (testnet only; mainnet migration is a later, separately-approved program).
- Neo X / EVM lane expansion beyond keeping Foundry suites green.
- New miniapp development; this program refactors/verifies existing apps.
