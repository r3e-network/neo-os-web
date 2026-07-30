# Phase 0–2: Stabilize Baselines, Joint Audit, Testnet Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish green test baselines in all three repos, produce a joint audit report, and verify the deployed platform-contract slice on NEO testnet (execute pending timelocks, cohort-0 registration, live cross-repo suites) using the operator testnet WIF.

**Architecture:** No new production code in this plan — it is the stabilization + audit + live-verification foundation for the platform contract library program (spec: `docs/superpowers/specs/2026-07-18-joint-platform-contract-library-design.md`). Later phases (library expansion, framework dedup, migration, UI/UX) get their own plans informed by the Phase 1 audit.

**Tech Stack:** C# / neo-devpack-dotnet (nccs 3.9.1, .NET 10, `DOTNET_ROOT=$HOME/.dotnet`), Node 22 (vitest / node:test / jest), Go (`//go:build scripts` deploy tooling, neo-go v0.116.0), NEO N3 testnet (magic `894710606`, RPC `https://testnet1.neo.coz.io:443`).

## Global Constraints

- **Repo roots:** MINIAPPS=`/Users/jinghuiliao/git/r3e/neo-os-web`, MORPHEUS=`/Users/jinghuiliao/git/r3e/neo-os-services`, AA=`/Users/jinghuiliao/git/r3e/neo-abstract-account`.
- **Git mutations need explicit user approval.** Before the first `git add`/`git commit`/`git rm` in any repo, ask the user once for a batch commit policy covering this plan. Until approved, stage nothing; record intended commits in the task notes instead.
- **Operator WIF handling:** the user-provided testnet WIF is supplied ONLY via `export NEO_TESTNET_WIF='...'` in the shell session. Never write it to any file, never echo it into logs, never commit it.
- **Chain writes:** every deploy/registration script runs dry-run first. Live writes additionally require `PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false` and `CONFIRM_PLATFORM_REGISTRY_DEPLOY=I_UNDERSTAND_THIS_WRITES_CHAIN` (per-script confirm var names are shown in each task).
- **Network assertion:** testnet magic `894710606` is asserted by the Go scripts before any write; if a script reports a magic mismatch, STOP and report — do not force.
- **Do not switch branches** in any repo. MORPHEUS is on `chore/solc-0.8.35-upgrade` with 71 dirty files; MINIAPPS has ~70 uncommitted v2 files; AA has 24 dirty files. Tests run against the current working trees.
- **Destructive commands** (`rm -rf` on the AA junk dirs) require explicit user confirmation at execution time.

---

### Task 1: AA repo — fresh-clone breakage inventory + junk dir removal

**Files:**
- Verify untracked: `AA/scripts/dotnet_env.sh`, `AA/shared/registrationAccountId.mjs`
- Delete: 18 directories in AA whose names contain literal newlines
- Read: `AA/.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: clean AA working tree of newline-junk; confirmed list of 2 untracked files that MUST be committed later (fresh-clone breakage: `contracts/compile.sh:7` and `scripts/verify_repo.sh:6` both `source scripts/dotnet_env.sh`; tracked `sdk/js/src/index.js` requires `shared/registrationAccountId.mjs`).

- [ ] **Step 1: Inventory the newline-junk directories**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account
find . -name $'*\n*' -prune | wc -l
find . -name $'*\n*' -prune
```
Expected: `18`; listing shows paths like `./contracts/UnifiedSmartWallet.Admin.cs\ntests` (a file name, newline, then `tests`).

- [ ] **Step 2: Verify none of the junk paths are git-tracked**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account
python3 - <<'EOF'
import subprocess
tracked = subprocess.run(['git','ls-files','-z'],capture_output=True).stdout.split(b'\0')
junk = [p for p in tracked if b'\n' in p]
print('tracked junk paths:', len(junk))
for p in junk: print(repr(p))
EOF
```
Expected: `tracked junk paths: 0`. If non-zero, STOP and report to the user (deleting tracked files is a git mutation needing approval).

- [ ] **Step 3: Delete the junk directories (after user confirmation)**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account
find . -name $'*\n*' -prune -exec rm -rf {} +
find . -name $'*\n*' -prune | wc -l
```
Expected: second command prints `0`.

- [ ] **Step 4: Confirm .gitignore needs no cleanup**

`AA/.gitignore` is 22 lines of normal entries (verified 2026-07-18) — the "multi-line garbage entries" from the earlier audit note are already gone. Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account
git status --porcelain | grep -c '^??' || true
```
Expected: only `?? scripts/dotnet_env.sh` and `?? shared/registrationAccountId.mjs` remain as untracked entries (no junk paths).

- [ ] **Step 5: Record intended commit (no git mutation without approval)**

Note for the batch commit: `git add scripts/dotnet_env.sh shared/registrationAccountId.mjs` with message `fix: track dotnet_env.sh and registrationAccountId.mjs (fresh-clone breakage)`.

---

### Task 2: AA repo — baseline test suites

**Files:**
- Test: `AA/tests/AbstractAccount.Contracts.Tests/` (MSTest, 157 methods)
- Test: `AA/sdk/js/tests/*.unit.test.js` (9 files, 78 assertions)
- Test: `AA/frontend/tests/*.test.js` (58 files)

**Interfaces:**
- Consumes: Task 1's verified env files (`scripts/dotnet_env.sh` sets `DOTNET_ROOT`/PATH for `dotnet`).
- Produces: baseline pass/fail record for the Phase 0 report (Task 5).

- [ ] **Step 1: Contract tests**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account
source scripts/dotnet_env.sh
dotnet test neo-abstract-account.sln --nologo 2>&1 | tail -5
```
Expected: `Passed! - Failed: 0, Passed: 157` (or current count; record actuals). If the solution file name differs, run `ls *.sln` and use the actual name.

- [ ] **Step 2: SDK unit tests**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account/sdk/js
node --test tests/*.unit.test.js 2>&1 | tail -5
```
Expected: `# pass 78`, `# fail 0`.

- [ ] **Step 3: Frontend tests**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account/frontend
node --test tests/*.test.js 2>&1 | tail -5
```
Expected: all files pass; record `# pass` / `# fail` counts.

---

### Task 3: Miniapps repo — baseline test suites

**Files:**
- Test: `MINIAPPS/framework/` (vitest, 553 tests), `MINIAPPS/apps/shared/` (vitest, 4424 tests), `MINIAPPS/deploy/scripts/lib/*.test.mjs` (60 tests), `MINIAPPS/contracts/__tests__/` (xunit, 505 methods)

**Interfaces:**
- Consumes: nothing (npm deps already installed; dotnet + nccs 3.9.1 confirmed installed).
- Produces: baseline pass/fail record for Task 5.

- [ ] **Step 1: Framework + shared + deploy-scripts vitest**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
npm run -s test:framework 2>&1 | tail -3
npm run -s test:shared 2>&1 | tail -3
npm run -s test:deploy-scripts 2>&1 | tail -3
```
Expected: framework `Tests 553 passed`; shared `Tests 4424 passed`; deploy-scripts 60 pass, 0 fail.

- [ ] **Step 2: Contract xunit suite**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
npm run -s test:contracts 2>&1 | tail -5
```
Expected: `Failed: 0`, ~505 passed. If nccs-built NEFs are stale, first `npm run -s build:contracts`.

- [ ] **Step 3: Integration + host-app jest**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
npm run -s test:integration 2>&1 | tail -3
npm run -s test:host-app 2>&1 | tail -3
```
Expected: integration suites pass; host-app jest passes. Record actuals (failures here go into the baseline report as known-debt, they do not block Phase 1).

---

### Task 4: Morpheus repo — baseline test suites

**Files:**
- Test: `MORPHEUS/contracts/__tests__/NeoContracts.Tests.csproj` (16 xunit files)
- Test: `MORPHEUS/scripts/*.test.mjs`, `MORPHEUS/deploy/cloudflare/morpheus-control-plane/worker.test.mjs`, `MORPHEUS/deploy/{feed-pusher,nitro,evm}/*.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: baseline pass/fail record for Task 5.

- [ ] **Step 1: Contract tests**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-services
dotnet test contracts/__tests__/NeoContracts.Tests.csproj --nologo 2>&1 | tail -5
```
Expected: `Failed: 0`; record passed count.

- [ ] **Step 2: Script / control-plane / ops suites**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-services
npm run -s test:scripts 2>&1 | tail -3
npm run -s test:control-plane 2>&1 | tail -3
npm run -s test:ops 2>&1 | tail -3
```
Expected: all pass; record counts. Suites requiring network/secrets that fail on missing env go into the baseline report as env-gated, not failures.

---

### Task 5: Phase 0 baseline report

**Files:**
- Create: `MINIAPPS/docs/reports/joint-baseline-2026-07-18.md`

**Interfaces:**
- Consumes: results recorded in Tasks 1–4.
- Produces: the baseline table referenced by Phase 1 (audit) and Phase 7 (final verification) of the spec.

- [ ] **Step 1: Write the report**

Create `docs/reports/joint-baseline-2026-07-18.md` with: per-repo table of suite → command → pass/fail counts → notes; the AA hygiene outcome (18 junk dirs removed, 2 files pending commit); working-tree states (MINIAPPS ~70 modified, MORPHEUS 71 dirty on `chore/solc-0.8.35-upgrade`, AA 24 dirty); and the list of intended-but-unapproved commits.

- [ ] **Step 2: Verify report accuracy**

Re-read the report and spot-check two numbers against the actual command outputs saved from Tasks 2–4. Expected: numbers match.

---

### Task 6: Joint security audit (parallel subagents)

**Files:**
- Create: `MINIAPPS/docs/reports/audit-findings-2026-07/miniapps.json`
- Create: `MINIAPPS/docs/reports/audit-findings-2026-07/morpheus.json`
- Create: `MINIAPPS/docs/reports/audit-findings-2026-07/aa.json`

**Interfaces:**
- Consumes: nothing (read-only audit).
- Produces: three findings JSON files, each an array of `{id, severity (critical|high|medium|low), area, file:line, title, description, recommendation}` consumed by Task 8.

- [ ] **Step 1: Dispatch three parallel audit subagents**

Agent 1 (MINIAPPS) focus list:
- `contracts/platform/PlatformRegistry/Treasury.cs` + `Accounts.cs` — role-bound treasury lanes, timelock bypass paths
- `contracts/platform/AppAccount/` — `executeTransfer` registry-only gate, `escapeExecute` 30d pause logic
- `contracts/platform/PlatformGame/` RewardGame settle path (uncommitted v2 partials included)
- `deploy/scripts/deploy_private_kernel.go` — fulfillment-digest reimplementation vs morpheus kernel parity
- `platform/edge/functions/_shared/` — service-role key handling, auth chain (CORS→auth→rate-limit→scope→manifest permission→appId)

Agent 2 (MORPHEUS) focus list:
- `contracts/MorpheusOracle/` — OR-D-03 callback reverse-mapping hijack (confirm fixed-in-source), `ExpireStaleRequest` inbox gap, storage-prefix footgun (`MorpheusOracle.cs:64-93`)
- `workers/nitro-worker/src/oracle/crypto.js:228-238` — swallowed keystore error silently regenerating oracle key
- `workers/nitro-worker` sandbox runners (`script-runner.js`, `wasm-runner.js`) — env-toggleable permission model
- `workers/morpheus-relayer` — fulfillment auth, cursor/durable-intake ordering
- VRF relayer-local `crypto.randomBytes` fallback when `enclaveFulfill` is off

Agent 3 (AA) focus list:
- `frontend/api/relay-transaction.js` (836 lines) — WIF handling, raw-tx forwarding gate (`AA_RELAY_ALLOW_RAW_FORWARD`), hash pinning, rate limiting
- `contracts/UnifiedSmartWallet*.cs` — wildcard `ContractPermission("*","*")` blast radius, storage prefix 0x12/0x13 reuse, escape-hatch timelock + silent auto-cancel
- `contracts/verifiers/` + `contracts/hooks/` — `AuthorizedCore` routing invariant (plugins must only accept config via core)
- `contracts/recovery/MorpheusSocialRecoveryVerifier` — guardian flow correctness

- [ ] **Step 2: Validate findings files**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
for f in docs/reports/audit-findings-2026-07/*.json; do node -e "const a=require('./$f'); if(!Array.isArray(a)) throw 1; console.log('$f', a.length, 'findings')"; done
```
Expected: three files parse as arrays; counts printed.

---

### Task 7: Duplication census

**Files:**
- Create: `MINIAPPS/docs/reports/audit-findings-2026-07/duplication.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `{cloneFamilyLoc, cloneFamilyContracts, morpheusEnginePorts, envelopeCopies, sdkGenerations}` consumed by Task 8.

- [ ] **Step 1: Measure the TEE skill-game clone family**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web/contracts
for d in MiniAppAimMaster MiniAppColorClash MiniAppCurveArrow MiniAppFlappyDash MiniAppGame2048 MiniAppJumpRush MiniAppMergeKingdom MiniAppPetPotion MiniAppSheepSolitaire MiniAppSnakeBounty MiniAppSudoku; do
  [ -d "$d" ] && echo "$d $(cat "$d"/*.cs 2>/dev/null | wc -l)"
done
```
Expected: 10–11 dirs, ~815 LOC each. Record total.

- [ ] **Step 2: Verify morpheus engine ports match app logic**

Run:
```bash
ls /Users/jinghuiliao/git/r3e/neo-os-services/workers/nitro-worker/src/game/engines/
head -5 /Users/jinghuiliao/git/r3e/neo-os-services/workers/nitro-worker/src/game/engines/snake.js
```
Expected: 12 JS files; header confirms "JS port of neo-os-web/apps/snake-bounty/src/logic/snake-engine.ts".

- [ ] **Step 3: Envelope copy drift check**

Run:
```bash
shasum -a 256 /Users/jinghuiliao/git/r3e/neo-os-services/packages/shared/src/confidential-envelope.js \
  /Users/jinghuiliao/git/r3e/neo-abstract-account/frontend/src/utils/morpheusEncryption.js
```
Expected: record both hashes; note whether they match (miniapps TS copy is a port, checked by its own drift guard).

- [ ] **Step 4: Write duplication.json**

Aggregate Steps 1–3 plus the SDK-generations finding (framework/ vs apps/shared/services vs platform/sdk) into `duplication.json`.

---

### Task 8: Joint audit report

**Files:**
- Create: `MINIAPPS/docs/reports/joint-audit-2026-07.md`

**Interfaces:**
- Consumes: Task 6 findings JSONs, Task 7 duplication.json, known-debt items from exploration (OR-D-03, divergent PlatformAnchor hashes, stale deploy_all.sh roster, Playwright e2e failing, AA junk dirs now cleaned).
- Produces: ranked findings table mapped to refactor actions; this report is the input to the Phase 3+ plans.

- [ ] **Step 1: Write the report**

Sections: (1) Executive summary; (2) Critical/high findings with file:line and recommended action; (3) Medium/low; (4) Duplication census with LOC numbers and dedup targets; (5) Known-debt register carried from existing audits; (6) Mapping table: finding → spec phase that resolves it.

- [ ] **Step 2: Consistency check**

Verify every critical/high finding cites a concrete `file:line` and a recommendation. Fix inline if not.

---

### Task 9: Operator account + timelock state check (read-only)

**Files:**
- Uses: `MINIAPPS/deploy/scripts/deploy_platform_registry.go` (`verify` action)
- Uses: `MINIAPPS/deploy/config/platform-registry-testnet-2026-07-17.json` (deployment record)

**Interfaces:**
- Consumes: `NEO_TESTNET_WIF` in env.
- Produces: confirmed signer address, GAS balance sufficiency, timelock maturity state — gates Task 10.

- [ ] **Step 1: Read-only registry state dump**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
export NEO_TESTNET_WIF='<operator-wif-from-user>'
go run -tags=scripts deploy/scripts/deploy_platform_registry.go
```
with `PLATFORM_REGISTRY_ACTION=verify` exported. Expected: state dump prints admin, artifact proposal status, engine row status, smoke app row; no writes occur (verify is read-only).

- [ ] **Step 2: Dry-run execute-timelocks to validate signer + GAS floor**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
export NEO_TESTNET_WIF='<operator-wif-from-user>'
PLATFORM_REGISTRY_ACTION=execute-timelocks go run -tags=scripts deploy/scripts/deploy_platform_registry.go
```
(Dry-run is default — no CONFIRM vars.) Expected: prints derived signer address, GAS balance vs `PLATFORM_REGISTRY_MIN_GAS` floor (default 1 for execute-timelocks), and whether the two 24h timelocks (artifact + engine row, proposed 2026-07-17) are mature. If GAS insufficient → STOP, report to user (funding needed). If timelocks not yet mature → record the maturity timestamp and schedule the live run after it.

---

### Task 10: Execute pending PlatformRegistry timelocks (live)

**Files:**
- Uses: `MINIAPPS/deploy/scripts/deploy_platform_registry.go`

**Interfaces:**
- Consumes: Task 9 green (signer funded, timelocks mature).
- Produces: `setAppAccountArtifact` executed + `registerEngine("platform-game")` executed on testnet registry `0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b`; updated deploy report JSON.

- [ ] **Step 1: Live execute-timelocks**

Run:
```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
export NEO_TESTNET_WIF='<operator-wif-from-user>'
PLATFORM_REGISTRY_ACTION=execute-timelocks \
PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false \
CONFIRM_PLATFORM_REGISTRY_DEPLOY=I_UNDERSTAND_THIS_WRITES_CHAIN \
go run -tags=scripts deploy/scripts/deploy_platform_registry.go
```
Expected: two transactions sent, both HALT (no FAULT); report JSON written under `deploy/config/` (or `PLATFORM_REGISTRY_DEPLOY_REPORT_PATH`).

- [ ] **Step 2: Verify post-state**

Run: `PLATFORM_REGISTRY_ACTION=verify go run -tags=scripts deploy/scripts/deploy_platform_registry.go`
Expected: artifact row active, `platform-game` engine row active.

---

### Task 11: Wire engine + full-loop proof (live)

**Files:**
- Uses: `MINIAPPS/deploy/scripts/deploy_platform_registry.go` (`wire-engine`, `full-loop`)

**Interfaces:**
- Consumes: Task 10 completed; PlatformGame v2 testnet hash `0xc75b181b4561462903bb27d8d9e0b32b637bec12` (or `PLATFORM_GAME_TESTNET_HASH` override if redeployed).
- Produces: engine bound to registry (`setRegistry` + read-back), smoke app's AppAccount minted (first registry-minted per-app account), engine `activateApp` push proof, RewardGame descriptor applied, reward pool funded.

- [ ] **Step 1: wire-engine (dry-run, then live)**

```bash
PLATFORM_REGISTRY_ACTION=wire-engine go run -tags=scripts deploy/scripts/deploy_platform_registry.go   # dry-run
PLATFORM_REGISTRY_ACTION=wire-engine PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false \
CONFIRM_PLATFORM_REGISTRY_DEPLOY=I_UNDERSTAND_THIS_WRITES_CHAIN \
go run -tags=scripts deploy/scripts/deploy_platform_registry.go                                       # live
```
Expected: `setRegistry` tx HALT; read-back `registry()` equals `0x5ec036ef…`.

- [ ] **Step 2: full-loop (dry-run, then live)**

Same env pattern with `PLATFORM_REGISTRY_ACTION=full-loop`. Expected: executes timelock idempotently (skips already-executed), wires engine, mints AppAccount for the smoke app, activates an app on the engine, applies descriptor (`platform-game:dailyCap=10`), funds reward pool (default 2 GAS target); final report shows all steps HALT.

- [ ] **Step 3: Verify**

`PLATFORM_REGISTRY_ACTION=verify` dump shows smoke app row with non-empty `accountHash`. Record the minted AppAccount address in the Phase 2 deployment record (Task 14).

---

### Task 12: Cohort-0 lite registration of all 77 apps (live)

**Files:**
- Uses: `MINIAPPS/deploy/scripts/register_apps_on_platform_registry.go`

**Interfaces:**
- Consumes: Task 10 (registry engine table live). Lite registration is engineless — does not require Task 11, but MUST follow Task 10.
- Produces: 77 appIds registered lite on PlatformRegistry; registration report JSON.

- [ ] **Step 1: Dry-run**

```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
export NEO_TESTNET_WIF='<operator-wif-from-user>'
go run -tags=scripts deploy/scripts/register_apps_on_platform_registry.go
```
Expected: dry-run prints the 77-app roster, per-app fee estimate (~1 GAS lite), total cost; signer balance check passes for the total.

- [ ] **Step 2: Live**

```bash
PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false \
CONFIRM_PLATFORM_REGISTRY_DEPLOY=I_UNDERSTAND_THIS_WRITES_CHAIN \
go run -tags=scripts deploy/scripts/register_apps_on_platform_registry.go
```
Expected: registrations HALT; script is idempotent (skips already-registered appIds) — re-run safe.

- [ ] **Step 3: Verify**

Read back a sample (first, middle, last appId) via `PLATFORM_REGISTRY_ACTION=verify` or the registry `getApp` read; expected: rows exist with `level=lite`.

---

### Task 13: Cross-repo live verification suites

**Files:**
- Uses: `MINIAPPS/deploy/scripts/verify_cross_repo_testnet.sh` (`npm run test:testnet:direct`)
- Uses: `AA/sdk/js/run_testnet_validation_suite.sh`
- Uses: `MORPHEUS/scripts/run_workspace_live_validation.sh`

**Interfaces:**
- Consumes: Tasks 10–12; `NEO_TESTNET_WIF` env; sibling repos at their documented paths (scripts resolve them automatically; `AA_ROOT`/`MINIAPPS_ROOT`/`MORPHEUS_ORACLE_ROOT` overrides exist if needed).
- Produces: live verification results recorded in the Phase 2 deployment record (Task 14).

- [ ] **Step 1: Miniapps cross-repo direct test**

```bash
cd /Users/jinghuiliao/git/r3e/neo-os-web
npm run -s test:testnet:direct
```
Expected: runtime-catalog parity across all three repos PASS; direct-oracle and AA+paymaster+relay live paths PASS.

- [ ] **Step 2: AA testnet validation (dry-run, then smoke)**

```bash
cd /Users/jinghuiliao/git/r3e/neo-abstract-account/sdk/js
./run_testnet_validation_suite.sh --dry-run
node tests/v3_testnet_smoke.js
```
Expected: dry-run gates pass; smoke test passes against AA core `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2`.

- [ ] **Step 3: Morpheus workspace live validation**

```bash
cd /Users/jinghuiliao/git/r3e/neo-os-services
bash scripts/run_workspace_live_validation.sh
```
Expected: workspace context collection across all three repos + live lanes PASS. Suites that require morpheus operator secrets (CVM endpoints) and fail on missing env are recorded as env-gated, not failures.

---

### Task 14: Phase 2 deployment record

**Files:**
- Modify: `MINIAPPS/docs/archive/claudedocs/contract-estate-census-2026-07-16.md` (or successor census entry) — resolve the divergent PlatformAnchor hash rows and stale roster rows against live testnet state
- Create: `MINIAPPS/deploy/config/joint-testnet-baseline-2026-07-18.md`

**Interfaces:**
- Consumes: all Phase 2 outputs.
- Produces: the canonical post-Phase-2 testnet state record (registry hash, engine hash, minted AppAccount addresses, cohort-0 roster, suite results) used by Phase 3+ planning.

- [ ] **Step 1: Write the deployment record** with exact hashes, tx ids, timestamps, suite outcomes, and env-gated skips.

- [ ] **Step 2: Reconcile census** — for each stale/divergent row (8 stale roster rows, 2 PlatformAnchor hashes `0xab079b4f…` vs `0xeb6b3725…`), query testnet (`getcontractstate` via RPC) and record which hash is live; update the census doc accordingly (doc edit only, no contract change).

---

## Self-Review Notes

- Spec coverage: this plan covers spec Phases 0–2 only, by design (Scope Check); Phases 3–7 require Phase 1 audit output and get separate plans.
- Task 9/10/11 ordering: `execute-timelocks` → `wire-engine` → `full-loop` matches the script's documented lifecycle (`deploy_platform_registry.go:5-19`); `full-loop` re-executes earlier steps idempotently, so partial re-runs are safe.
- Env var names verified against source: `PLATFORM_REGISTRY_ACTION`, `PLATFORM_REGISTRY_DEPLOY_DRY_RUN`, `CONFIRM_PLATFORM_REGISTRY_DEPLOY`, `NEO_TESTNET_WIF` (`deploy_platform_registry.go:31-54`, `register_apps_on_platform_registry.go:179-182,400`).
- Timelock maturity: proposed 2026-07-17, 24h → mature 2026-07-18; Task 9 Step 2 re-checks on-chain before the live run.
