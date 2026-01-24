# Decouple Miniapps Remaining Work Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish decoupling contracts from the platform repo and add an npm publish workflow for `@neo/uniapp-sdk`.

**Architecture:** Keep only platform contracts in this repo (all miniapp contracts + frameworks live in the miniapps repo). Publish the SDK from `packages/@neo/uniapp-sdk` via a dedicated GitHub Actions workflow using an `NPM_TOKEN` secret.

**Tech Stack:** Bash, TypeScript/Vitest, GitHub Actions.

### Task 1: Finalize platform-only contracts

**Files:**
- Modify: `contracts/README.md`
- Modify: `contracts/build.sh`
- Test: `contracts/__tests__/platform-contracts-only.test.ts`

**Step 1: Run the existing contract scope test**

Run: `npx vitest run contracts/__tests__/platform-contracts-only.test.ts`  
Expected: PASS. If it fails, stop and follow @superpowers:systematic-debugging before changing code.

**Step 2: Update contracts README to list only platform contracts**

Edit `contracts/README.md` to remove miniapp contract references and list:
`AppRegistry`, `AutomationAnchor`, `PauseRegistry`, `PaymentHub`, `PriceFeed`, `RandomnessLog`, `ServiceLayerGateway`, `UniversalMiniApp`.

**Step 3: Verify build script only targets platform contracts**

Review/update `contracts/build.sh` so it only builds platform contracts and does not reference any `MiniApp*` contracts or devpack builds.

**Step 4: Re-run the contract scope test**

Run: `npx vitest run contracts/__tests__/platform-contracts-only.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add contracts/README.md contracts/build.sh contracts/__tests__/platform-contracts-only.test.ts contracts/build contracts/*
git commit -m "chore: keep platform contracts only"
```

### Task 2: Add SDK publish workflow (TDD)

**Files:**
- Create: `packages/@neo/uniapp-sdk/__tests__/package-json.test.ts`
- Modify: `packages/@neo/uniapp-sdk/package.json`
- Create: `.github/workflows/publish-uniapp-sdk.yml`

**Step 1: Write the failing test**

Create `packages/@neo/uniapp-sdk/__tests__/package-json.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('package.json', () => {
  it('is publishable (not private)', () => {
    const packageJsonPath = resolve(__dirname, '..', 'package.json');
    const contents = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(contents);

    expect(pkg.private).not.toBe(true);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/@neo/uniapp-sdk/__tests__/package-json.test.ts`  
Expected: FAIL with `Expected: not true` if `private` is still set.

**Step 3: Make minimal change to pass**

Edit `packages/@neo/uniapp-sdk/package.json` to remove `private: true` (or set it to `false`).

**Step 4: Re-run the test to verify it passes**

Run: `npx vitest run packages/@neo/uniapp-sdk/__tests__/package-json.test.ts`  
Expected: PASS.

**Step 5: Add publish workflow**

Create `.github/workflows/publish-uniapp-sdk.yml` that:
- Runs on `workflow_dispatch` and on `push` tags like `@neo/uniapp-sdk@*`
- Uses `actions/setup-node` with `registry-url: https://registry.npmjs.org`
- Installs deps with `pnpm install --frozen-lockfile`
- Runs SDK tests (`pnpm -C packages/@neo/uniapp-sdk test`)
- Publishes with `npm publish` in `packages/@neo/uniapp-sdk`
- Uses `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` (never hardcode the token)

**Step 6: Commit**

```bash
git add packages/@neo/uniapp-sdk/__tests__/package-json.test.ts packages/@neo/uniapp-sdk/package.json .github/workflows/publish-uniapp-sdk.yml
git commit -m "ci: add npm publish workflow for uniapp sdk"
```

### Task 3: Verification sweep

**Files:**
- Test: `contracts/__tests__/platform-contracts-only.test.ts`
- Test: `packages/@neo/uniapp-sdk/__tests__/package-json.test.ts`

**Step 1: Run contract scope test**

Run: `npx vitest run contracts/__tests__/platform-contracts-only.test.ts`  
Expected: PASS.

**Step 2: Run SDK package test**

Run: `npx vitest run packages/@neo/uniapp-sdk/__tests__/package-json.test.ts`  
Expected: PASS.
