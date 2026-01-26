# Host MiniApp Layout Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure the host app renders MiniApps in web layout by default, switches to mobile layout only for mobile wallet environments, and honors `?layout=web|mobile` overrides.

**Architecture:** Introduce a shared layout resolver in the host app that combines explicit overrides with environment detection (mobile device + injected wallet). Reuse it across embed points to feed the same layout into entry URLs, SDK config, and frame sizing.

**Tech Stack:** Next.js (pages), React, TypeScript, Jest.

---

### Task 1: Add layout resolver utilities (tests first)

**Files:**
- Create: `platform/host-app/lib/miniapp-layout.ts`
- Test: `platform/host-app/__tests__/lib/miniapp-layout.test.ts`

**Step 1: Write the failing test**

```ts
import { parseLayoutParam, resolveMiniAppLayout } from "../../lib/miniapp-layout";

describe("miniapp layout", () => {
  it("parses explicit layout overrides", () => {
    expect(parseLayoutParam("web")).toBe("web");
    expect(parseLayoutParam("mobile")).toBe("mobile");
    expect(parseLayoutParam(["mobile"]) ).toBe("mobile");
    expect(parseLayoutParam("invalid")).toBeNull();
  });

  it("prefers override over environment detection", () => {
    expect(
      resolveMiniAppLayout({
        override: "web",
        isMobileDevice: true,
        hasWalletProvider: true,
      }),
    ).toBe("web");
  });

  it("returns mobile only for mobile device + wallet", () => {
    expect(resolveMiniAppLayout({ isMobileDevice: true, hasWalletProvider: true })).toBe("mobile");
    expect(resolveMiniAppLayout({ isMobileDevice: true, hasWalletProvider: false })).toBe("web");
    expect(resolveMiniAppLayout({ isMobileDevice: false, hasWalletProvider: true })).toBe("web");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/lib/miniapp-layout.test.ts`
Expected: FAIL with "Cannot find module '../../lib/miniapp-layout'"

**Step 3: Write minimal implementation**

```ts
export type MiniAppLayout = "web" | "mobile";

type LayoutOverride = string | string[] | null | undefined;

type ResolveLayoutOptions = {
  override?: LayoutOverride;
  isMobileDevice?: boolean;
  hasWalletProvider?: boolean;
};

export function parseLayoutParam(value: LayoutOverride): MiniAppLayout | null {
  if (Array.isArray(value)) return parseLayoutParam(value[0]);
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "web" || normalized === "mobile") return normalized;
  return null;
}

export function resolveMiniAppLayout(options: ResolveLayoutOptions = {}): MiniAppLayout {
  const override = parseLayoutParam(options.override ?? null);
  if (override) return override;
  return options.isMobileDevice && options.hasWalletProvider ? "mobile" : "web";
}
```

**Step 4: Run test to verify it passes**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/lib/miniapp-layout.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/host-app/lib/miniapp-layout.ts \
  platform/host-app/__tests__/lib/miniapp-layout.test.ts
git commit -m "feat(host-app): add miniapp layout resolver"
```

---

### Task 2: Add host layout hook (tests first)

**Files:**
- Create: `platform/host-app/hooks/useMiniAppLayout.ts`
- Test: `platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts`

**Step 1: Write the failing test**

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { useMiniAppLayout } from "../../hooks/useMiniAppLayout";

describe("useMiniAppLayout", () => {
  it("returns override immediately", async () => {
    const { result } = renderHook(() => useMiniAppLayout("mobile"));
    expect(result.current).toBe("mobile");
  });

  it("detects mobile wallet environment", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      configurable: true,
    });
    (window as any).ethereum = {};

    const { result } = renderHook(() => useMiniAppLayout());

    await waitFor(() => {
      expect(result.current).toBe("mobile");
    });

    delete (window as any).ethereum;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/hooks/useMiniAppLayout.test.ts`
Expected: FAIL with "Cannot find module '../../hooks/useMiniAppLayout'"

**Step 3: Write minimal implementation**

```ts
import { useEffect, useState } from "react";
import { parseLayoutParam, resolveMiniAppLayout, type MiniAppLayout } from "@/lib/miniapp-layout";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaMobile = typeof navigator.userAgentData === "object" && navigator.userAgentData?.mobile;
  if (uaMobile) return true;
  const ua = navigator.userAgent || "";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
}

function hasWalletProvider(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).ReactNativeWebView ||
      (window as any).NEOLineN3 ||
      (window as any).NEOLine ||
      (window as any).neo3Dapi ||
      (window as any).OneGate ||
      (window as any).ethereum,
  );
}

export function useMiniAppLayout(override?: string | string[] | null): MiniAppLayout {
  const [layout, setLayout] = useState<MiniAppLayout>(() => parseLayoutParam(override) ?? "web");

  useEffect(() => {
    const resolved = resolveMiniAppLayout({
      override,
      isMobileDevice: isMobileDevice(),
      hasWalletProvider: hasWalletProvider(),
    });
    setLayout(resolved);
  }, [override]);

  return layout;
}
```

**Step 4: Run test to verify it passes**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/hooks/useMiniAppLayout.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/host-app/hooks/useMiniAppLayout.ts \
  platform/host-app/__tests__/hooks/useMiniAppLayout.test.ts
git commit -m "feat(host-app): add miniapp layout hook"
```

---

### Task 3: Wire layout into MiniAppViewer (tests first)

**Files:**
- Modify: `platform/host-app/components/features/miniapp/MiniAppViewer.tsx`
- Modify: `platform/host-app/__tests__/components/MiniAppViewerLayout.test.tsx`

**Step 1: Write the failing test**

```ts
import { installMiniAppSDK } from "@/lib/miniapp-sdk";

describe("MiniAppViewer", () => {
  it("passes resolved layout to SDK and federated apps", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      configurable: true,
    });
    (window as any).NEOLineN3 = {};

    render(<MiniAppViewer app={app} locale="en" />);

    expect(installMiniAppSDK).toHaveBeenCalledWith(expect.objectContaining({ layout: "mobile" }));
    expect(federatedSpy).toHaveBeenCalledWith(expect.objectContaining({ layout: "mobile" }));

    delete (window as any).NEOLineN3;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/components/MiniAppViewerLayout.test.tsx`
Expected: FAIL (layout remains "web")

**Step 3: Write minimal implementation**

- Add `layout?: "web" | "mobile"` prop to `MiniAppViewer`.
- Use `useMiniAppLayout(layout)` inside `MiniAppViewer` to resolve effective layout.
- Pass layout into `buildMiniAppEntryUrl`, `installMiniAppSDK`, `MiniAppFrame`, and `FederatedMiniApp`.

**Step 4: Run test to verify it passes**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/components/MiniAppViewerLayout.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/host-app/components/features/miniapp/MiniAppViewer.tsx \
  platform/host-app/__tests__/components/MiniAppViewerLayout.test.tsx
git commit -m "feat(host-app): pass layout through MiniAppViewer"
```

---

### Task 4: Apply layout hook to embed pages (tests first)

**Files:**
- Modify: `platform/host-app/pages/launch/[id].tsx`
- Modify: `platform/host-app/pages/miniapps/[id].tsx`
- Modify: `platform/host-app/pages/app/[id].tsx`
- Modify: `platform/host-app/pages/container.tsx`
- Modify: `platform/host-app/pages/federated.tsx`
- Modify: `platform/host-app/__tests__/pages/launch.[id].test.tsx`

**Step 1: Write the failing test**

```ts
it("honors layout override in iframe src", async () => {
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    query: { id: "test-app", layout: "mobile" },
  });

  await renderLaunchPage();
  const iframe = document.querySelector("iframe");
  expect(iframe?.src).toBe("https://example.com/app?lang=en&theme=dark&embedded=1&layout=mobile");
});
```

**Step 2: Run test to verify it fails**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/pages/launch.[id].test.tsx`
Expected: FAIL (still `layout=web`)

**Step 3: Write minimal implementation**

- Import and use `useMiniAppLayout(router.query.layout)` in each page.
- Replace hard-coded `layout: "web"` with resolved `layout` for:
  - `buildMiniAppEntryUrl`
  - `installMiniAppSDK`
  - `MiniAppFrame` `layout` prop
  - `FederatedMiniApp` `layout` prop
- In `/app/[id]`, pass the resolved `layout` to `<MiniAppViewer layout={layout} ... />`.

**Step 4: Run test to verify it passes**

Run: `CI=1 pnpm -C platform/host-app test -- __tests__/pages/launch.[id].test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/host-app/pages/launch/[id].tsx \
  platform/host-app/pages/miniapps/[id].tsx \
  platform/host-app/pages/app/[id].tsx \
  platform/host-app/pages/container.tsx \
  platform/host-app/pages/federated.tsx \
  platform/host-app/__tests__/pages/launch.[id].test.tsx
git commit -m "feat(host-app): resolve miniapp layout per environment"
```

---

### Task 5: Full verification

**Step 1: Run host tests**

Run: `CI=1 pnpm -C platform/host-app test`
Expected: PASS

**Step 2: Run build**

Run: `pnpm -C platform/host-app build`
Expected: PASS

**Step 3: Commit remaining changes (if any)**

```bash
git add -A
git commit -m "chore: finalize miniapp layout selection"
```
