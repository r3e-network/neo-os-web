# MiniApp Layout Flag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a deterministic `layout=web|mobile` signal (URL + SDK config) so MiniApps render web layout on desktop and mobile layout in the wallet.

**Architecture:** Hosts append `layout` to entry URLs and include it in `miniapp_config`; the uniapp SDK resolves layout with config + query + environment fallback. Federated MiniApps pass layout as a prop.

**Tech Stack:** Next.js (host/admin/builtin), React, React Native WebView, pnpm, Jest/Vitest.

### Task 1: Web host layout param + config (tests first)

**Files:**
- Modify: `platform/host-app/__tests__/pages/launch.[id].test.tsx`
- Modify: `platform/host-app/pages/launch/[id].tsx`
- Modify: `platform/host-app/pages/miniapps/[id].tsx`
- Modify: `platform/host-app/components/features/miniapp/MiniAppViewer.tsx`
- Modify: `platform/host-app/pages/container.tsx`
- Modify: `platform/host-app/lib/miniapp-sdk.ts`
- Modify: `platform/host-app/lib/sdk/client.js`
- Modify: `platform/host-app/lib/sdk/types.ts`

**Step 1: Write the failing test**

Update the iframe src expectation to include layout, and assert `miniapp_config` includes `layout: "web"`.

```ts
// platform/host-app/__tests__/pages/launch.[id].test.tsx
expect(iframe?.src).toBe("https://example.com/app?lang=en&theme=dark&embedded=1&layout=web");
// Add new expectation on config postMessage (see MiniApp SDK bridge tests)
```

**Step 2: Run test to verify it fails**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/pages/launch.[id].test.tsx`  
Expected: FAIL on missing `layout=web` and config field.

**Step 3: Write minimal implementation**

Add `layout: "web"` to all host entry URL builders and include `layout` in SDK config:

```ts
buildMiniAppEntryUrl(entryUrl, { lang: supportedLocale, theme, embedded: "1", layout: "web" });
```

```ts
// platform/host-app/lib/sdk/client.js
const layout = config?.layout;
getConfig: () => ({ appId, chainId, chainType, contractAddress, supportedChains, chainContracts, layout, debug: false })
```

**Step 4: Run test to verify it passes**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/pages/launch.[id].test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add platform/host-app/__tests__/pages/launch.[id].test.tsx \
  platform/host-app/pages/launch/[id].tsx \
  platform/host-app/pages/miniapps/[id].tsx \
  platform/host-app/components/features/miniapp/MiniAppViewer.tsx \
  platform/host-app/pages/container.tsx \
  platform/host-app/lib/miniapp-sdk.ts \
  platform/host-app/lib/sdk/client.js \
  platform/host-app/lib/sdk/types.ts
git commit -m "feat(host-app): add layout to miniapp urls and config"
```

### Task 2: Admin console preview layout param

**Files:**
- Modify: `platform/admin-console/src/app/miniapps/page.tsx`

**Step 1: Write the failing test**

No existing tests cover preview URLs; skip test and keep change minimal.

**Step 2: Implement minimal change**

Append `layout=web` when building preview URLs:

```ts
return `${resolved}${separator}lang=${locale}&theme=${theme}&embedded=1&layout=web`;
```

**Step 3: Commit**

```bash
git add platform/admin-console/src/app/miniapps/page.tsx
git commit -m "feat(admin-console): add layout param to preview urls"
```

### Task 3: Mobile wallet layout param + config (tests first)

**Files:**
- Create: `platform/mobile-wallet/src/lib/miniapp/entry-url.ts`
- Modify: `platform/mobile-wallet/src/components/miniapp/MiniAppViewer.tsx`
- Modify: `platform/mobile-wallet/src/lib/miniapp/sdk-types.ts`
- Test: `platform/mobile-wallet/__tests__/miniapp-entry-url.test.ts`

**Step 1: Write the failing test**

```ts
// platform/mobile-wallet/__tests__/miniapp-entry-url.test.ts
import { buildMiniAppEntryUrlForWallet } from "../src/lib/miniapp/entry-url";

it("adds layout=mobile to wallet entry urls", () => {
  const url = buildMiniAppEntryUrlForWallet("https://example.com/app", {
    lang: "en",
    theme: "dark",
    embedded: "1",
  });
  expect(url).toBe("https://example.com/app?lang=en&theme=dark&embedded=1&layout=mobile");
});
```

**Step 2: Run test to verify it fails**

Run: `CI=1 pnpm -C platform/mobile-wallet test -- __tests__/miniapp-entry-url.test.ts`  
Expected: FAIL (missing helper).

**Step 3: Write minimal implementation**

Create helper and use it in `MiniAppViewer`:

```ts
// entry-url.ts
export function buildMiniAppEntryUrlForWallet(entryUrl, params) {
  return buildMiniAppEntryUrl(entryUrl, { ...params, layout: "mobile" });
}
```

Add `layout: "mobile"` to the `miniappConfig` object and pass layout in `createMiniAppSDK` config if needed.

**Step 4: Run test to verify it passes**

Run: `CI=1 pnpm -C platform/mobile-wallet test -- __tests__/miniapp-entry-url.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add platform/mobile-wallet/src/lib/miniapp/entry-url.ts \
  platform/mobile-wallet/src/components/miniapp/MiniAppViewer.tsx \
  platform/mobile-wallet/src/lib/miniapp/sdk-types.ts \
  platform/mobile-wallet/__tests__/miniapp-entry-url.test.ts
git commit -m "feat(wallet): add layout=mobile for miniapp urls and config"
```

### Task 4: Uniapp SDK layout inference (tests first)

**Files:**
- Modify: `packages/@neo/uniapp-sdk/src/types.ts`
- Modify: `packages/@neo/uniapp-sdk/src/bridge.ts`
- Test: `packages/@neo/uniapp-sdk/__tests__/layout.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveLayout } from "../src/bridge";

describe("resolveLayout", () => {
  it("prefers config.layout", () => {
    expect(resolveLayout({ layout: "mobile" })).toBe("mobile");
  });

  it("falls back to query param", () => {
    window.history.pushState({}, "", "/?layout=web");
    expect(resolveLayout({})).toBe("web");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/@neo/uniapp-sdk test -- __tests__/layout.test.ts`  
Expected: FAIL (helper missing).

**Step 3: Write minimal implementation**

Add `layout?: "web" | "mobile"` to `MiniAppSDKConfig`, add `resolveLayout` helper in `bridge.ts`, and ensure `getConfig()` returns layout with inference.

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/@neo/uniapp-sdk test -- __tests__/layout.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/@neo/uniapp-sdk/src/types.ts \
  packages/@neo/uniapp-sdk/src/bridge.ts \
  packages/@neo/uniapp-sdk/__tests__/layout.test.ts
git commit -m "feat(uniapp-sdk): resolve layout with config and environment fallback"
```

### Task 5: Federated miniapp layout prop + builtin layout styling

**Files:**
- Modify: `platform/host-app/components/FederatedMiniApp.tsx`
- Modify: `platform/host-app/components/features/miniapp/MiniAppViewer.tsx`
- Modify: `platform/host-app/pages/miniapps/[id].tsx`
- Modify: `platform/host-app/pages/launch/[id].tsx`
- Modify: `platform/host-app/pages/federated.tsx`
- Modify: `platform/builtin-app/src/components/BuiltinApp.tsx`
- Modify: `platform/builtin-app/src/components/BuiltinApp.module.css`

**Step 1: Implement minimal change**

Pass `layout` into `FederatedMiniApp` and add `layout` prop to builtin app root:

```tsx
<FederatedMiniApp ... layout="web" />
```

```tsx
<div className={styles.root} data-layout={layout} ... />
```

Add mobile layout adjustments in CSS under `[data-layout="mobile"]`.

**Step 2: Manual check (no automated tests)**

Use `pnpm -C platform/host-app test -- __tests__/pages/launch.[id].test.tsx` to ensure no regressions.

**Step 3: Commit**

```bash
git add platform/host-app/components/FederatedMiniApp.tsx \
  platform/host-app/components/features/miniapp/MiniAppViewer.tsx \
  platform/host-app/pages/miniapps/[id].tsx \
  platform/host-app/pages/launch/[id].tsx \
  platform/host-app/pages/federated.tsx \
  platform/builtin-app/src/components/BuiltinApp.tsx \
  platform/builtin-app/src/components/BuiltinApp.module.css
git commit -m "feat(federation): pass layout and style builtin app"
```

### Task 6: Docs update

**Files:**
- Modify: `platform/docs/distributed-miniapps-guide.md`
- Modify: `platform/host-app/README.md`

**Step 1: Update docs**

Document `layout=web|mobile` in entry URL params and `miniapp_config.layout` in SDK config.

**Step 2: Commit**

```bash
git add platform/docs/distributed-miniapps-guide.md platform/host-app/README.md
git commit -m "docs: document miniapp layout param and config"
```

### Final verification

Run full suite:

```bash
CI=1 VITEST_DISABLE_WATCH=1 pnpm test
pnpm build
```

Expected: all tests and builds pass.
