# Systematic Audit — neo-os-web

| Field | Value |
| --- | --- |
| **Date** | 2026-07-15 |
| **Repo / HEAD** | `master @ 7bda5de384f6a4b44414cd95a6c89aea1199dcc4` |
| **Mode** | Analysis / certification (no remediation implemented) |
| **Working tree** | **Dirty** — ~119 modified/untracked paths (apps WIP, deploy scripts, docs, contracts tests, etc.) |
| **Evidence dir** | `{SCRATCH}/audit/` → `/var/folders/4c/mvvl373n0c70kx4vhzlb9fdw0000gn/T/grok-goal-afc2b3fea40e/implementer/audit/` |
| **Prior baselines** | `claudedocs/security-audit-2026-06-16.md`, `claudedocs/full-system-verification-2026-07.md` |
| **Overall verdict** | **PASS-WITH-FINDINGS** |

**Classification key (matches prior full-system verification discipline):**

| Tag | Meaning |
| --- | --- |
| **(A)** | Committed product / config / deploy defect on this tree |
| **(B)** | In-flight WIP (dirty-tree parallel work) |
| **(C)** | Env / tooling / load flake or live-RPC contingency |

Only **(A)** items count as product defects in the executive verdict. Security residual items that live in external repos (`neo-morpheus-oracle`, `neo-abstract-account`) are residual risks, not in-repo (A) defects.

---

## 1. Scope / inventory

### 1.1 Surfaces audited

| Surface | Inventory | Audit method | Status |
| --- | --- | --- | --- |
| **apps/** | ~77 MiniApp packages + `apps/shared` (+ tooling dirs) | Offline coverage/playarea/media/layout audits; `test:shared`; miniapp runner | **Audited** |
| **framework/** | Framework SDK + vitest suite | Full `vitest run` + security spotcheck (permissions/reward gates) | **Audited** |
| **platform/host-app** | Next.js host, API routes, bridge, sponsor RPC | Full unit suite | **Audited** |
| **platform/admin-console** | Operator console | Full unit suite | **Audited** |
| **platform/edge** | 97 function dirs (~42 `os-*` binders + auth/gas/market/etc.) | Full `deno test` | **Audited** |
| **platform/sdk** | Typed client + bridge | Full `vitest run` (70 tests) | **Audited** |
| **platform/shared** | Shared platform packages/i18n fixtures | Inventory + referenced by host/admin | **Audited (shallow)** — no dedicated failing suite |
| **contracts/** | 35 MiniApp contract projects + `platform/` domains + DevPack | `dotnet test` 440 green; settle/payout sampling | **Audited** |
| **deploy/** | Offline audit scripts, migrations, k8s | Offline audits + deploy-script unit tests | **Audited** |
| **Root tooling** | `package.json` scripts, `test/integration`, Makefile targets | Integration suite (live testnet) + script inventory | **Audited** |
| **docs/SECURITY_CHECKLIST + PRODUCTION_READINESS** | Read against live codepaths | Cross-check with security review | **Audited** |

### 1.2 Explicitly deferred

| Item | Reason |
| --- | --- |
| Full deep audit of `neo-morpheus-oracle` / `neo-abstract-account` internals | Out of repo boundary; integration surface + prior audit residual status only |
| Live mainnet fund-moving / TEE re-attestation | Requires secrets + production cert; non-goal |
| Exhaustive line-by-line review of every MiniApp binary/asset | Automated coverage + gates; sample on failures |
| UX / art polish / product roadmap | Non-goal |
| Live smoke (`test:testnet:live*`) full path | Env credentials not assumed; integration suite already hit public testnet RPCs |
| Clean green re-verify of entire monorepo under empty working tree | Tree is WIP-contaminated (see §5) |

### 1.3 App / contract census (from inventory log)

- MiniApp app dirs under `apps/`: **~77** product apps (excluding `shared` / tsconfig helpers).
- Contract projects: MiniApp* (AimMaster … TipJar, Tarot, TarotVrf, Credits, …) + `contracts/platform/*` + DevPack.
- Edge functions: **97** top-level function packages (includes `_shared`).
- Coverage audit classification (exit 0): testnet+mainnet **36**, testnet-only **15**, frontend-only **24**, source-only **2**.

---

## 2. Automated health gates

All commands run 2026-07-15 against HEAD `7bda5de` with dirty tree. Logs: `{SCRATCH}/audit/*.log`.

### 2.1 Unit / package suites

| Gate | Command | Result | Class of failures |
| --- | --- | --- | --- |
| Framework | `cd framework && npx vitest run` | **431 passed / 0 failed** (33 files), EXIT 0 | — |
| apps/shared | `cd apps/shared && npx vitest run` | **4381 passed / 1 failed** (395 files), EXIT 1 | **(C)** `i18n-key-parity` / `aa-session-key-lab` **timeout 5000ms** (load flake; not a missing-key assertion) |
| MiniApp runner | `node scripts/run-miniapp-tests.mjs` | **23/23 suites passed**, EXIT 0 | — |
| Host-app | `npm run test:host-app` | **1127 passed / 7 failed** (173 suites; 2 failed), EXIT 1 | **(A)** permission/definition drift — see findings H1–H2 |
| Admin-console | `npm run test:admin-console` | **395 passed / 10 failed** (55 files), EXIT 1 | **(A)** light-chrome style contracts vs current shell — findings A1 |
| Deploy scripts | `npm run test:deploy-scripts` | **194 passed / 14 failed** (208), EXIT 1 | **(A)** structure/registry/hygiene drift — findings D1–D4 |
| Contracts | `npm run test:contracts` (`dotnet test`) | **440 passed / 0 failed**, EXIT 0 | — |
| Edge | `deno test --allow-env --allow-net functions/` | **169 passed / 0 failed**, EXIT 0 | — |
| SDK | `cd platform/sdk && npx vitest run` | **70 passed / 0 failed**, EXIT 0 | — |
| Integration (live RPC) | `npm run test:integration` | **25 passed / 7 failed** (32), EXIT 1 | **(A)** testnet ABI/name/domain drift — findings I1–I3 |

### 2.2 Offline audit scripts

| Gate | Command | Exit | Summary | Class |
| --- | --- | --- | --- | --- |
| Coverage | `audit:miniapps:coverage` | **0** | 77 apps classified; RPC unknown = 0 | pass |
| Playareas | `audit:miniapps:playareas` | **1** | 76 usable; **1** needs-follow-up (`nft-factory` staging/status language) | **(A)** Low |
| Media | `audit:miniapps:media` | **1** | 3 duplicate-media groups (neo-pay ↔ shared-example icons/banners; oracle console stage banners) | **(A)** Low |
| Layout | `audit:miniapps:layout` | **1** | 7 apps fail strict `MiniAppPage`/`ConsoleMiniApp` marker check: `arrow-escape`, `asset-factory`, `bead-workshop`, `curve-arrow`, `fruit-funnel`, `nft-factory`, `on-chain-tarot` (most are Phaser/factory with `defineMiniApp` + alternate PlayArea wiring) | **(A)** Low–Med (audit rule may be overly strict vs modern Phaser/factory patterns) |
| Unified layers | `audit:platform:unified-layers` | **0** | error=0, warn=3 (locale base-merge: bead-workshop, fruit-funnel, neo-pay), info=5 | pass w/ warns |
| Contract domains | `audit:contract-domains` | **1** | 41/46 configured; chain_ok=31; **mismatch=10**; config_missing=5; unique actionable=15 | **(A)** Med — mainnet NNS/domain vs hash drift |

### 2.3 Security spotcheck (evidence)

| Gate | Command | Result |
| --- | --- | --- |
| Framework reward + permissions | `vitest run test/reward-permission-gate.test.ts test/permissions-surface.test.ts` | **21 passed / 0 failed** → `security-spotcheck.log` |

### 2.4 Not run / env limits

| Gate | Reason |
| --- | --- |
| `test:testnet:live*` / full live smoke | Not required for offline certification; integration already exercised public testnet RPC |
| `fuzz:*` / multiuser sim | Optional soak; not in minimum gate set |
| Mainnet method verification with privileged keys | Env secrets not assumed |

### 2.5 Gate rollup

| Bucket | Count |
| --- | --- |
| Fully green critical path suites | framework, contracts, edge, sdk, miniapp runner, security spotcheck, coverage, unified-layers |
| Red with **(A)** product/config drift | host-app (7), admin-console (10), deploy-scripts (14), integration (7), playareas/media/layout/domains |
| Red with **(C)** only | shared i18n timeout (1) |
| Confirmed **(B)** blockers for clean re-verify | Dirty tree (~119 paths): sheep-solitaire art/engine, forever-album, neo-message, automation-copilot, deploy scripts, host-app bridge WIP, etc. — **not** used to excuse committed-manifest failures above |

---

## 3. Security / economic review

### 3.1 Money-touching & auth-critical paths (re-checked on source)

| Path | Evidence | Assessment |
| --- | --- | --- |
| **Sponsor GAS (`platform/host-app/pages/api/rpc/sponsor.ts` + `lib/sponsor-quota.ts`)** | Durable `sponsor_global_budget_bump` + `rate_limit_bump` RPCs; fail-closed on store unavailable; per-tx 0.5 GAS, global 50 GAS/day, 5 tx/user/hour; mainnet opt-in `SPONSOR_ALLOW_MAINNET`; wallet auth + user-witness required | **C5 FIXED in-repo** (was High open). Migration `deploy/migrations/077_sponsor_global_gas_budget.sql` present. |
| **Edge rate limit (`platform/edge/functions/_shared/ratelimit.ts`)** | Default fail-closed on bump error; fail-open only if `EDGE_RATELIMIT_FAIL_OPEN=true` **and** non-production | Hardened; test env logs fail-open only because env opt-in. |
| **OS storage grant (C9)** | `os-storage-grant-access` → `recordStorageGrant`; `os-storage-read-shared` → `hasStorageGrant`; table migration `076_miniapp_storage_grants.sql` | **FIXED** (advisory visibility filter; on-chain kernel state remains world-readable — correctly documented in `storage-grants.ts`). |
| **Auth social merge (C8)** | `auth-social-sync/index.ts` requires `email_verified === true` before email-based account merge | **FIXED** |
| **House game settle beacon** | `contracts/MiniApp.DevPack/MiniAppHouseGameBase.Settle.cs` fixed multi-block beacon (commitIndex+1..K), abort-retry inert | **A1/A2 class FIXED** (matches 2026-06-16 remediation) |
| **SDK bridge origin** | `platform/sdk/src/client.ts` `messageVerified`; nep21 comments reject `"*"` broadcast | Prior Low fixed; sdk **70/70** green |
| **Framework reward permission gate** | spotcheck 21/21 | Green |
| **Secrets in tree** | `.env.example` uses placeholders; prior real WIF scrubbed with comments | No new committed secret material found in sample |

### 3.2 Prior audit open items — re-check status

Source: `claudedocs/security-audit-2026-06-16.md` (incl. later remediation rounds in same file).

| ID | Sev (orig) | Topic | Status **2026-07-15** | Notes |
| --- | --- | --- | --- | --- |
| A1–A15 | Crit–Med | Platform/MiniApp contract settle, segregation, factory, etc. | **Fixed** (prior session + suite still 440/440) | Redeploy immutability residual for any pre-fix mainnet NEFs remains operational |
| B1–B10 | Crit–Med | AA contracts | **Fixed in AA repo** (prior); not re-audited deeply here | Residual: treat AA as external trust boundary |
| C5 | High | Paymaster/sponsor in-memory limits | **Fixed in this repo** | `sponsor-quota.ts` + migration 077 |
| C8 | Med | auth-social email merge takeover | **Fixed** | `email_verified` gate |
| C9 | Med | os-storage-grant stub | **Fixed** | grants table + read filter |
| C10 | Med | edge rate-limit fail-open | **Fixed** (default fail-closed) | Opt-in fail-open for local only |
| C1 | High | Oracle attestation advisory | **Fixed in oracle repo (round 4 note)** / residual ops: ensure `MORPHEUS_EXPECTED_PCR0` pinned in prod | Out-of-repo enforcement config |
| C2 | High | Plaintext key provision | **Fixed in oracle** (reject unless opt-in) | Residual: image pin discipline |
| C3 | High | Decrypt binding default | **Coordinated in oracle** | Residual: confirm prod env has binding required |
| neo-sig | Low | `_shared/neo.ts` sha256 vs wallet salted payload | **Still open (Low)** | `platform/edge/functions/_shared/neo.ts` still hashes raw message |
| host bridge Lows | Low | consent granularity / ACAO null | **Still open (Low)** | Follow-up hardening |
| Multisig cancel | Low | any-signer cancel | **Intentional design** | Documented decision |

### 3.3 New / current security-relevant findings from this pass

See §4 findings **S1** (confidential permission declarations) and residual external trust items in §6. No new Critical fund-drain bug was proven on committed contract/edge/sponsor code in this pass.

---

## 4. Findings table (prioritized)

### Critical

*None confirmed on current committed money paths.*

### High

*None newly confirmed as unfixed in-repo. Prior High C5 is fixed. External oracle PCR pin / decrypt-binding remain operational residual risks (not in-repo code defects).*

### Medium

| ID | Sev | Class | Finding | Evidence path |
| --- | --- | --- | --- | --- |
| **I1** | Med | (A) | Live testnet integration: several manifests/hashes disagree with deployed contract **names/ABIs** (e.g. dice-game hash resolves as `MiniAppDiceGameV2` while tests expect `PlatformGame`; missing methods `getOwner/0`, `getGame/1`, `checkIn`, `borrow`/`repay`, `oracle/0`). | `test/integration/*.test.mjs` log `test-integration.log`; manifests under `apps/*/neo-manifest.json` |
| **I2** | Med | (A) | Contract domain audit: **10** mainnet NNS/domain mismatches, **5** config_missing, **15** unique actionable bindings (breakup, daily-checkin, dev-tipping, dice-game, fogplay, gasbox, gov-merc, last-survivor, neo-multisig, neo-pay-shared-example, oracle-price-console, red-envelope, self-loan, time-capsule, morpheus oracle domain). | `docs/reports/contract-domain-coverage-latest.json`; `audit-contract-domains.log` |
| **H1** | Med | (A) | Confidential Morpheus MiniApps do not declare permission strings that coerce to `permissions.confidential` (+ oracle/compute). Manifests: `oracle-compute-lab` permissions `[]`; `oracle-neodid-console` lacks confidential/neodid token; `recovery-guardian` lacks confidential. Host privacy gate tests fail. | `apps/oracle-compute-lab/neo-manifest.json`, `apps/oracle-neodid-console/neo-manifest.json`, `apps/recovery-guardian/neo-manifest.json`; `platform/host-app/__tests__/lib/privacy-miniapps.test.ts`; coerce logic `platform/host-app/lib/miniapp.ts` |
| **H2** | Med | (A) | Host miniapp-definition loader tests fail: expected detail templates / operations missing for neo-swap, memorial-shrine, shared-mode examples, raw public definitions — catalog/definition files out of sync with tests (or intentional simplification without test update). | `platform/host-app/__tests__/lib/miniapp-definitions.test.ts` + definition JSON under host-app / apps |
| **D1** | Med | (A) | Generated `MINIAPP_CONTRACTS` registry / gas-lucky-pool manifest / resolved validator hashes out of sync with app manifests (deploy-script tests). | `deploy/scripts/lib/*.test.mjs` failures in `test-deploy-scripts.log` |

### Low

| ID | Sev | Class | Finding | Evidence path |
| --- | --- | --- | --- | --- |
| **A1** | Low | (A) | Admin console shell style contracts fail (expect `bg-white`, ban glass/dark tokens, Inter font-family fallback) — UI redesign vs stale style tests. | `platform/admin-console/src/**/__tests__/*` (DashboardPage, Header, Sidebar, PageHeader, admin-shell-style) |
| **D2** | Low | (A) | Nested `apps/zhuada-e/package-lock.json` violates monorepo lock ownership rule. | `deploy/scripts/lib/ci_workflow.test.mjs`; path `apps/zhuada-e/package-lock.json` |
| **D3** | Low | (A) | Frontend structure tests fail for AA/recovery card rules, Neo Treasury v2, On-Chain Tarot Phaser surface, Oracle Price Console drawer labels, burn-league entrypoint shape, miniapp index.html entrypoints. | `deploy/scripts/lib/*frontend*.test.mjs` / related |
| **D4** | Low | (A) | Live harness coverage goal-gate / classification tests fail (audit output shape/list drift). | `deploy/scripts` harness tests in `test-deploy-scripts.log` |
| **M1** | Low | (A) | Duplicate media content across neo-pay / neo-pay-shared-example and oracle console stage banners. | `audit-miniapps-media.log` |
| **M2** | Low | (A) | Playarea catalog: `nft-factory` flagged for staging/status-only user-facing language. | `docs/reports/miniapp-playarea-functionality-latest.json` |
| **L1** | Low | (A) | Layout consistency audit fails 7 apps (Phaser/factory without `MiniAppPage`/`ConsoleMiniApp` markers). | `audit-miniapps-layout.log`; e.g. `apps/curve-arrow/src/main.tsx` uses `defineMiniApp` |
| **U1** | Low | (A) | Unified-layers warns: locale files not merging shared base messages (bead-workshop, fruit-funnel, neo-pay). | `audit-platform-unified-layers.log` |
| **S-neo-sig** | Low | (A residual) | Edge Neo signature verify still uses raw `sha256(message)` (prior Low). | `platform/edge/functions/_shared/neo.ts` |
| **SH1** | Low | (C) | apps/shared i18n parity test for `aa-session-key-lab` timed out at 5s under load — not a proven missing key. | `test-shared.log` |

---

## 5. WIP / dirty-tree contamination note

`git status` at audit time: **~119** dirty paths. Dominant clusters:

- `apps/` (sheep-solitaire art/engine, forever-album, neo-message, automation-copilot, flappy-dash, …)
- `deploy/` scripts and reports
- `contracts/` untracked/modified fixtures
- host-app / framework / package-lock touch points

**Impact:** Full clean green re-verify of the monorepo is blocked until WIP lands or is stashed. Failures above were **not** attributed to (B) unless the failure mode was a timeout (SH1) or clearly uncommitted-only. Host definition/privacy and integration ABI mismatches reproduce against **committed** manifests and public RPC — classified **(A)**.

---

## 6. Residual risks

1. **Immutable deployed NEFs:** Source-level contract fixes (2026-06-16) only protect newly deployed code; any mainnet instance still on pre-remediation NEFs retains historical risk until upgrade/redeploy governance.
2. **External trust root (Oracle/AA):** Attestation PCR pins, decrypt-binding defaults, and AA recovery key custody live outside this repo; production misconfiguration can re-open High residual even when platform code is green.
3. **Shared storage grants are advisory:** On-chain kernel state is public; TEE/sealed storage is the real confidentiality boundary (`storage-grants.ts` documents this).
4. **Sponsor path depends on Supabase RPCs:** Fail-closed is correct; mis-migrated prod DB (missing 077) yields 503 sponsorship outage, not silent drain — ops must apply migrations.
5. **Testnet catalog drift (I1/I2):** Users and automations may call method names that deployed contracts no longer expose; wallet UX may surface FAULT rather than clean errors.
6. **Confidential permission labeling (H1):** Host may not surface/enforce confidential capability gates for apps that actually hit confidential Oracle lanes.
7. **Host overload / long suites:** Shared vitest ~85s+ with timeout flakes; CI should isolate or raise timeouts carefully without masking real misses.

---

## 7. Recommended next actions (not implemented in this goal)

1. **P0 — Catalog / chain consistency:** Reconcile testnet+mainnet hashes, NNS domains, and ABI expectations (`bind:contract-domains` / redeploy or update manifests); fix integration fixtures to match intentional DiceGameV2 migration.
2. **P0 — Confidential manifests:** Add explicit permission tokens (`confidential` / `oracle` / `compute` as required by `coerceMiniAppInfo`) to Morpheus confidential apps; re-run `privacy-miniapps.test.ts`.
3. **P1 — Host definitions:** Align miniapp definition JSON with loader tests or update tests if product intentionally simplified templates/operations.
4. **P1 — Deploy-script drift:** Regenerate `MINIAPP_CONTRACTS` registry; remove `apps/zhuada-e/package-lock.json`; refresh frontend structure tests after scene redesigns.
5. **P2 — Admin style contracts:** Update admin-console style tests to the new light shell (or restore tokens if redesign was accidental).
6. **P2 — Offline audit hygiene:** Unique media for neo-pay-shared-example; either teach layout audit about Phaser/factory PlayAreas or add accepted markers; clear nft-factory staging copy.
7. **P3 — Residual Lows:** neo-sig wallet message format reconciliation; host bridge consent granularity.
8. **Process:** Land or isolate WIP before the next full-system certification so (B) noise is zero.

---

## 8. Executive verdict

| Dimension | Verdict |
| --- | --- |
| Core security money/auth paths (sponsor, edge RL, grants, social merge, house settle, reward gates) | **Pass** — prior High platform items fixed; spotchecks green |
| Contract unit correctness | **Pass** (440/440) |
| Edge unit correctness | **Pass** (169/169) |
| Framework / SDK / miniapp runner | **Pass** |
| Host/admin/deploy offline quality gates | **Fail partial** — definition/style/registry/media/layout drift (**(A)**, non-fund-critical) |
| Live testnet consistency | **Fail partial** — ABI/name/domain mismatches (**(A)** Med) |
| **Overall** | **PASS-WITH-FINDINGS** |

**Rationale:** No newly confirmed Critical or unfixed High fund-drain defect in this repo’s money paths. Automated critical suites (contracts, edge, framework security gates, miniapp runner) are green. Multiple Medium catalog/deploy consistency and host definition issues are real committed defects and must be remediated before claiming full production cleanliness; they do not, on current evidence, re-open the 2026-06-16 Critical settle/re-roll class.

---

## 9. Evidence index

| Artifact | Path |
| --- | --- |
| Inventory | `{SCRATCH}/audit/00-inventory.log` |
| Framework | `{SCRATCH}/audit/test-framework.log` |
| Shared | `{SCRATCH}/audit/test-shared.log` |
| Host-app | `{SCRATCH}/audit/test-host-app.log` |
| Admin-console | `{SCRATCH}/audit/test-admin-console.log` |
| Deploy scripts | `{SCRATCH}/audit/test-deploy-scripts.log` |
| Contracts | `{SCRATCH}/audit/test-contracts.log` |
| Edge | `{SCRATCH}/audit/test-edge.log` |
| SDK | `{SCRATCH}/audit/test-sdk.log` |
| Miniapps runner | `{SCRATCH}/audit/test-miniapps.log` |
| Integration | `{SCRATCH}/audit/test-integration.log` |
| Offline audits | `{SCRATCH}/audit/audit-miniapps-*.log`, `audit-platform-unified-layers.log`, `audit-contract-domains.log` |
| Security spotcheck | `{SCRATCH}/audit/security-spotcheck.log` |
| Domain JSON | `docs/reports/contract-domain-coverage-latest.json` |
| Playarea JSON | `docs/reports/miniapp-playarea-functionality-latest.json` |

`{SCRATCH}` = `/var/folders/4c/mvvl373n0c70kx4vhzlb9fdw0000gn/T/grok-goal-afc2b3fea40e/implementer`
