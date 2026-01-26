# Repo Quality Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove obsolete artifacts, reduce duplication (legacy SDK), align SDK naming/docs, and validate local build/test so the repo is production-ready.

**Architecture:** Keep existing module boundaries; remove unused legacy SDK; keep the MiniApp client SDK as `packages/@neo/uniapp-sdk` (published as `@r3e/uniapp-sdk`); ensure host-side injection of `window.MiniAppSDK` remains in `platform/host-app`.

**Tech Stack:** Go, Node (pnpm workspace), Next.js, Supabase Edge.

---

### Task 1: Remove stray tracked artifacts and legacy root dirs

**Files:**
- Delete: `10000。`
- Delete: `deploy-miniapps-live`
- Delete: `frontend/README.md`
- Delete: `pages/api/activity/events.ts`
- Delete: `pages/api/activity/transactions.ts`
- Modify: `.gitignore`

**Step 1: Verify no references (non-code verification)**

Run:
```bash
rg -n --glob '!node_modules/**' --glob '!**/*.tsbuildinfo' "pages/api/activity" platform docs scripts
```
Expected: no references to the root `pages/api/activity` endpoints outside the host app.

**Step 2: Remove obsolete files**

```bash
rm "10000。" deploy-miniapps-live frontend/README.md pages/api/activity/events.ts pages/api/activity/transactions.ts
rmdir pages/api/activity pages/api frontend || true
```

**Step 3: Prevent binary re-addition**

Edit `.gitignore` to add a root ignore for the compiled binary:
```gitignore
/deploy-miniapps-live
```
Place it near the “Server binary (root level only)” section.

**Step 4: Verify tree state (non-code verification)**

```bash
git status -sb
```
Expected: deletions staged as tracked removals; no new unexpected files.

**Step 5: Commit (after final build/test in Task 6)**

---

### Task 2: Remove legacy platform SDK and align platform docs

**Files:**
- Delete: `platform/sdk/README.md`
- Delete: `platform/sdk/package.json`
- Delete: `platform/sdk/package-lock.json`
- Delete: `platform/sdk/src/**`
- Delete: `platform/sdk/examples/**`
- Delete: `platform/sdk/tsconfig.json`
- Modify: `platform/README.md`
- Modify: `docs/service-api.md`
- Modify: `docs/sdk-guide.md`
- Modify: `docs/CODE_REVIEW_GUIDE.md`
- Modify: `docs/MODULE_RESPONSIBILITIES.md`
- Modify: `docs/LAYERING.md`
- Modify: `docs/platform-mapping.md`
- Modify: `Makefile`

**Step 1: Remove legacy SDK package**

```bash
rm -rf platform/sdk
```

**Step 2: Update platform/docs references**

Apply these focused text updates:

- `platform/README.md`
  - Replace the intro line to drop “SDK” from the platform folder description.
  - Remove the `sdk/` bullet.
  - Add a sentence: “The MiniApp SDK source lives in `packages/@neo/uniapp-sdk` (published as `@r3e/uniapp-sdk`). The host injects `window.MiniAppSDK` from `platform/host-app/lib/miniapp-sdk`.”

- `docs/service-api.md`
  - Replace: `The JS SDK (\`platform/sdk\`) is expected to set \`edgeBaseUrl\` to:`
  - With: `The JS SDK (\`packages/@neo/uniapp-sdk\`) is expected to set \`edgeBaseUrl\` to:`

- `docs/sdk-guide.md`
  - Replace the SDK source sentence to reference `packages/@neo/uniapp-sdk` and the `@r3e/uniapp-sdk` package name.
  - Replace the “Host-Only APIs” section to remove `platform/sdk` and instead state that host-only APIs live in host app server code (`platform/host-app` + `platform/edge`) and are not exposed to untrusted MiniApps.

- `docs/CODE_REVIEW_GUIDE.md`
  - Rename section `4.1 SDK (platform/sdk/)` to `4.1 MiniApp SDK (packages/@neo/uniapp-sdk)`.
  - Update the key files list to point at `packages/@neo/uniapp-sdk/src/` (bridge/types/composables) instead of `platform/sdk/src/`.

- `docs/MODULE_RESPONSIBILITIES.md`
  - Replace the `platform/sdk` bullet with `packages/@neo/uniapp-sdk` and mention host-side injection lives in `platform/host-app/lib/miniapp-sdk`.

- `docs/LAYERING.md`
  - Replace `platform/sdk` bullet with `packages/@neo/uniapp-sdk` (MiniApp SDK, published as `@r3e/uniapp-sdk`).

- `docs/platform-mapping.md`
  - Replace `platform/sdk` bullet with `packages/@neo/uniapp-sdk` and note host injects `window.MiniAppSDK` from `platform/host-app`.

**Step 3: Update Makefile SDK targets**

- Remove the `sdk-build` and `sdk-typecheck` targets that reference `platform/sdk`.
- Update `install`, `build-all`, and `clean-all-deep` to use `packages/@neo/uniapp-sdk` instead of `platform/sdk`.

Suggested replacements:

```make
sdk-build: ## Build MiniApp SDK
	@echo "Building MiniApp SDK..."
	pnpm -C packages/@neo/uniapp-sdk build

sdk-typecheck: ## Typecheck MiniApp SDK
	pnpm -C packages/@neo/uniapp-sdk typecheck
```

In `install`:
```make
	@echo "→ MiniApp SDK (pnpm)..."
	pnpm -C packages/@neo/uniapp-sdk install
```

In `build-all`:
```make
	@$(MAKE) sdk-build
```

In `clean-all-deep`:
```make
	rm -rf packages/@neo/uniapp-sdk/node_modules
```

**Step 4: Verify docs for `platform/sdk` mentions**

```bash
rg -n "platform/sdk" docs platform Makefile
```
Expected: no remaining references outside legacy docs.

**Step 5: Commit (after final build/test in Task 6)**

---

### Task 3: Align SDK package name in host docs/UI

**Files:**
- Modify: `platform/host-app/docs/SDK.md`
- Modify: `platform/host-app/pages/docs.tsx`
- Modify: `platform/host-app/lib/i18n/locales/en/host.json`
- Modify: `platform/host-app/lib/i18n/locales/zh/host.json`
- Modify: `packages/@neo/uniapp-sdk/__tests__/exports.test.ts`

**Step 1: Update docs to use `@r3e/uniapp-sdk`**

- In `platform/host-app/docs/SDK.md`, replace all `@neo/uniapp-sdk` occurrences with `@r3e/uniapp-sdk`.
- In `platform/host-app/pages/docs.tsx`, replace the code block and example imports to use `@r3e/uniapp-sdk`.

**Step 2: Update UI strings**

- Replace `@neo/uniapp-sdk` with `@r3e/uniapp-sdk` in:
  - `platform/host-app/lib/i18n/locales/en/host.json`
  - `platform/host-app/lib/i18n/locales/zh/host.json`

**Step 3: Update SDK test description**

- In `packages/@neo/uniapp-sdk/__tests__/exports.test.ts`, change the suite name to `@r3e/uniapp-sdk exports`.

**Step 4: Verify no `@neo/uniapp-sdk` left in UI/docs**

```bash
rg -n "@neo/uniapp-sdk" platform/host-app packages docs
```
Expected: only legacy plan/report references remain (if any).

**Step 5: Commit (after final build/test in Task 6)**

---

### Task 4: Remove root npm lockfile and align ignore rules

**Files:**
- Delete: `package-lock.json`
- Modify: `.gitignore`

**Step 1: Remove root lockfile**

```bash
rm package-lock.json
```

**Step 2: Update `.gitignore` to fully ignore package-lock files**

Remove the exception line:
```gitignore
!package-lock.json
```

**Step 3: Verify**

```bash
rg -n "package-lock.json" .gitignore
```
Expected: only the `**/package-lock.json` ignore rule remains.

**Step 4: Commit (after final build/test in Task 6)**

---

### Task 5: Refresh workspace lockfile after removals

**Files:**
- Modify: `pnpm-lock.yaml`

**Step 1: Regenerate lockfile**

```bash
pnpm install
```
Expected: `pnpm-lock.yaml` updates to remove `platform/sdk` workspace entry.

**Step 2: Verify `platform/sdk` no longer in lockfile**

```bash
rg -n "platform/sdk" pnpm-lock.yaml
```
Expected: no matches.

**Step 3: Commit (after final build/test in Task 6)**

---

### Task 6: Full validation + commit/push gate

**Files:**
- (verification only)

**Step 1: Run tests**

```bash
CI=1 VITEST_DISABLE_WATCH=1 pnpm test
```
Expected: all test suites pass.

**Step 2: Run builds**

```bash
pnpm build
```
If `meshminiapp-host` fails with Webpack cache errors, retry with:
```bash
NEXT_DISABLE_COMPILE_CACHE=1 pnpm -C platform/host-app build
NEXT_DISABLE_COMPILE_CACHE=1 pnpm build
```
If failures persist, follow superpowers:systematic-debugging before any fixes.

**Step 3: Commit all changes**

```bash
git add -A
git commit -m "chore: clean legacy sdk and align miniapp docs"
```

**Step 4: Push**

```bash
git push -u origin repo-quality-review
```

---

**After completion:** use superpowers:finishing-a-development-branch to integrate.
