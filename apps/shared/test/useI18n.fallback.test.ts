import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createUseI18n } from "../react/hooks/useI18n";

describe("createUseI18n missing-key fallback", () => {
  it("resolves defined keys normally", () => {
    const useHook = createUseI18n({
      greeting: { en: "Hello", zh: "你好" },
      plain: "Plain string",
    });
    const { result } = renderHook(() => useHook());

    expect(result.current.t("greeting")).toBe("Hello");
    expect(result.current.t("plain")).toBe("Plain string");
  });

  it("surfaces the key name for missing keys in dev builds instead of a blank string", () => {
    const useHook = createUseI18n({ greeting: { en: "Hello", zh: "你好" } });
    const { result } = renderHook(() => useHook());

    // Vitest runs with import.meta.env.DEV=true, matching dev builds: an
    // absent key must be visible as the key name (a blank string previously
    // produced empty labels and Error("") toasts). Production builds keep ""
    // so `t(key) || fallback` chains continue to apply.
    expect(
      result.current.t("definitelyMissingI18nKey" as Parameters<typeof result.current.t>[0]),
    ).toBe("definitelyMissingI18nKey");
  });

  it("interpolates arguments into resolved messages", () => {
    const useHook = createUseI18n({
      counted: { en: "Found {count} items", zh: "找到 {count} 项" },
    });
    const { result } = renderHook(() => useHook());

    expect(result.current.t("counted", { count: 3 })).toBe("Found 3 items");
  });
});
