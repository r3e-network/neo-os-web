# Decouple MiniApps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple miniapps from the platform by moving `miniapps-uniapp` to a dedicated repo, routing all apps through the external submission pipeline with auto-approve/auto-build for internal apps, and publishing `@neo/uniapp-sdk` to npm.

**Architecture:** Platform repo becomes miniapp-agnostic: no miniapps source code, build scripts, or internal registry table. Miniapps repo owns all miniapp source and contracts. CI in miniapps repo submits builds to the platform via service-role auth and publishes CDN artifacts. Platform registry is sourced solely from `miniapp_submissions`.

**Tech Stack:** Supabase Edge Functions (Deno), Supabase Postgres, GitHub Actions, Vercel Blob CDN, pnpm, npm publishing.

## Task 1: Move `@neo/uniapp-sdk` into platform repo and prep npm publish

**Files:**
- Move: `miniapps-uniapp/packages/@neo/uniapp-sdk` -> `packages/@neo/uniapp-sdk`
- Modify: `pnpm-workspace.yaml`
- Modify: `docs/sdk-guide.md`
- Modify: `docs/getting-started/Quick-Start.md`
- Modify: `platform/host-app/docs/SDK.md`
- Modify: `platform/host-app/docs/README.md`

**Step 1: Write the failing test**

Create `packages/@neo/uniapp-sdk/__tests__/exports.test.ts`:

```ts
import { describe, it, expect } from "vitest";

// Ensure SDK entry exists for consumers
import * as sdk from "../src/index";

describe("@neo/uniapp-sdk exports", () => {
  it("exports a waitForSDK helper", () => {
    expect(typeof (sdk as any).waitForSDK).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/@neo/uniapp-sdk && pnpm vitest run`

Expected: FAIL because vitest is not configured or test runner missing.

**Step 3: Write minimal implementation**

- Add `vitest` to `packages/@neo/uniapp-sdk/package.json` devDependencies.
- Add `test` script to run vitest.
- Ensure `src/index.ts` exists and exports `waitForSDK` (if missing).

**Step 4: Run test to verify it passes**

Run: `cd packages/@neo/uniapp-sdk && pnpm test`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/@neo/uniapp-sdk pnpm-workspace.yaml docs/sdk-guide.md docs/getting-started/Quick-Start.md platform/host-app/docs/SDK.md platform/host-app/docs/README.md
git commit -m "chore: move uniapp sdk into platform packages"
```

## Task 2: Remove miniapps source from platform repo

**Files:**
- Delete: `miniapps-uniapp/`
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `Makefile`
- Delete or modify scripts referencing miniapps paths:
  - `scripts/export_host_miniapps.sh`
  - `platform/host-app/scripts/auto-discover-miniapps.js`
  - `platform/host-app/scripts/sync-chain-data.js`
  - `scripts/update-miniapp-main.sh`
  - `scripts/sync-contract-addresses.js`
  - `scripts/update-manifest-svg.sh`
  - `scripts/migrate-miniapp-assets.sh`
  - `scripts/fix-miniapp-scripts.sh`
  - `scripts/refactor_vite_configs.js`
  - `parallel_build.py`

**Step 1: Write the failing test**

Add `platform/host-app/__tests__/lib/miniapps-paths.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");

describe("miniapps paths", () => {
  it("no longer ships miniapps-uniapp in platform repo", () => {
    expect(fs.existsSync(path.join(repoRoot, "miniapps-uniapp"))).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd platform/host-app && pnpm vitest run __tests__/lib/miniapps-paths.test.ts`

Expected: FAIL because miniapps-uniapp exists.

**Step 3: Write minimal implementation**

- Remove `miniapps-uniapp/` directory.
- Remove `dev:miniapps`/`build:miniapps`/`test` tasks related to miniapps from `package.json` and `Makefile`.
- Remove miniapps scripts or replace them with stubs that instruct use of the miniapps repo.
- Update `pnpm-workspace.yaml` to drop miniapps paths.

**Step 4: Run test to verify it passes**

Run: `cd platform/host-app && pnpm vitest run __tests__/lib/miniapps-paths.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json Makefile scripts platform/host-app/scripts platform/host-app/__tests__/lib/miniapps-paths.test.ts
 git commit -m "chore: remove miniapps source from platform"
```

## Task 3: Remove internal miniapps registry and update registry view

**Files:**
- Delete: `platform/edge/functions/miniapp-internal/`
- Delete migration: `platform/supabase/migrations/20250123_miniapp_internal.sql`
- Modify: `platform/supabase/migrations/20250123_miniapp_registry_view.sql`
- Modify: `platform/docs/distributed-miniapps-guide.md`
- Modify: `platform/docs/miniapp-auto-publish-guide.md`
- Modify: `k8s/platform/edge/configmap.yaml`
- Modify: `platform/docs/distributed-miniapps-deployment-checklist.md`
- Modify: `platform/docs/database-setup-for-supabase.sql`

**Step 1: Write the failing test**

Add `platform/edge/functions/__tests__/miniapp-registry-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20250123_miniapp_registry_view.sql"),
  "utf8"
);

describe("miniapp registry view", () => {
  it("does not reference miniapp_internal", () => {
    expect(sql.includes("miniapp_internal")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-registry-view.test.ts`

Expected: FAIL since the view still references miniapp_internal.

**Step 3: Write minimal implementation**

- Remove `miniapp_internal` migration and references.
- Update `miniapp_registry_view` to use `miniapp_submissions` only.
- Remove `INTERNAL_MINIAPPS_*` envs from configs and docs.
- Remove `/miniapp-internal` edge function and docs.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-registry-view.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add platform/edge/functions platform/supabase/migrations platform/docs k8s/platform/edge/configmap.yaml
 git commit -m "chore: drop internal miniapp registry"
```

## Task 4: Auto-approve internal repo submissions + add publish endpoint

**Files:**
- Modify: `platform/edge/functions/miniapp-submit/index.ts`
- Modify: `platform/edge/functions/_shared/git-whitelist.ts`
- Add: `platform/edge/functions/miniapp-publish/index.ts`
- Modify: `platform/edge/functions/miniapp-approve/index.ts` (optional: reuse logic)
- Modify: `platform/docs/distributed-miniapps-guide.md`

**Step 1: Write the failing test**

Add `platform/edge/functions/__tests__/miniapp-internal-auto-approve.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAutoApprovedInternalRepo } from "../miniapp-submit/internal-approval";

describe("internal auto approve", () => {
  it("auto-approves r3e-network/miniapps", () => {
    expect(isAutoApprovedInternalRepo("https://github.com/r3e-network/miniapps")).toBe(true);
  });

  it("does not auto-approve other repos", () => {
    expect(isAutoApprovedInternalRepo("https://github.com/unknown/repo")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-internal-auto-approve.test.ts`

Expected: FAIL because helper does not exist.

**Step 3: Write minimal implementation**

- Add helper `isAutoApprovedInternalRepo` in a shared module under `platform/edge/functions/miniapp-submit/internal-approval.ts`.
- Use service role auth header detection to allow CI from miniapps repo.
- When auto-approved, set submission status to `building` (or `approved`) and record review notes.
- Add new endpoint `/functions/v1/miniapp-publish` that accepts service role, updates submission to `published` with CDN URL and assets.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-internal-auto-approve.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add platform/edge/functions platform/docs
 git commit -m "feat: auto-approve internal submissions and add publish endpoint"
```

## Task 5: Update docs and CI references to new miniapps repo

**Files:**
- Modify: `docs/QUICKSTART.md`
- Modify: `docs/manifest-spec.md`
- Modify: `docs/MONOREPO_ARCHITECTURE.md`
- Modify: `docs/tutorials/*` references to `miniapps-uniapp/apps`
- Modify: `platform/host-app/docs/README.md`
- Add: `docs/plans/2026-01-24-decouple-miniapps.md`

**Step 1: Write the failing test**

Add `docs/__tests__/miniapps-links.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const quickstart = readFileSync("docs/QUICKSTART.md", "utf8");

describe("docs miniapps links", () => {
  it("does not reference miniapps-uniapp", () => {
    expect(quickstart.includes("miniapps-uniapp")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run docs/__tests__/miniapps-links.test.ts`

Expected: FAIL.

**Step 3: Write minimal implementation**

- Update docs to reference `r3e-network/miniapps` and new paths.
- Remove internal miniapps auto-publish guide and replace with miniapps repo workflow docs.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run docs/__tests__/miniapps-links.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs
 git commit -m "docs: point miniapps references to new repo"
```

## Task 6: Remove miniapp contracts from platform repo

**Files:**
- Remove miniapp contracts in `contracts/` (keep platform contracts only)
- Modify: `contracts/README.md`
- Modify: `contracts/build.sh` and helper scripts to exclude removed contracts

**Step 1: Write the failing test**

Add `contracts/__tests__/platform-contracts-only.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const keep = new Set([
  "AppRegistry",
  "AutomationAnchor",
  "PauseRegistry",
  "PaymentHub",
  "PriceFeed",
  "RandomnessLog",
  "ServiceLayerGateway",
  "UniversalMiniApp",
]);

const entries = fs.readdirSync(path.resolve("contracts"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("."));

describe("platform contracts", () => {
  it("only contains platform contracts", () => {
    const unexpected = entries.filter((name) => !keep.has(name));
    expect(unexpected).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run contracts/__tests__/platform-contracts-only.test.ts`

Expected: FAIL.

**Step 3: Write minimal implementation**

- Remove miniapp-specific contract folders.
- Update build scripts to target only platform contracts.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run contracts/__tests__/platform-contracts-only.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add contracts
 git commit -m "chore: keep platform contracts only"
```

## Task 7: Add npm publish workflow for @neo/uniapp-sdk

**Files:**
- Add: `.github/workflows/publish-uniapp-sdk.yml`
- Modify: `packages/@neo/uniapp-sdk/package.json`

**Step 1: Write the failing test**

Add `packages/@neo/uniapp-sdk/__tests__/package-json.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import pkg from "../package.json";

describe("uniapp-sdk package metadata", () => {
  it("is publishable", () => {
    expect(pkg.private).not.toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/@neo/uniapp-sdk && pnpm vitest run __tests__/package-json.test.ts`

Expected: FAIL if package is still private.

**Step 3: Write minimal implementation**

- Remove `private: true` if present.
- Add publish workflow using `NPM_TOKEN`.

**Step 4: Run test to verify it passes**

Run: `cd packages/@neo/uniapp-sdk && pnpm vitest run __tests__/package-json.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/@neo/uniapp-sdk .github/workflows/publish-uniapp-sdk.yml
 git commit -m "ci: publish uniapp sdk to npm"
```

## Task 8: Verification

**Step 1: Run full test suite**

Run: `CI=1 npm test`

Expected: PASS.

**Step 2: Commit any remaining adjustments**

```bash
git status -sb
```

## Notes

- Miniapps repo CI should call `miniapp-submit` and `miniapp-publish` using the Supabase service role key.
- The platform repo will no longer call any miniapp build scripts.
- Dependabot/lockfile cleanup should occur after the split if still needed.
