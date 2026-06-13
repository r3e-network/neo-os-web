import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { createUseI18n as createUseI18nObservable } from "../composables/useI18n";
import { createUseI18n as createUseI18nReact } from "../react/hooks/useI18n";

// Vitest runs with import.meta.env.DEV = true, which is exactly the mode the
// warning targets. Production behavior (no warn, legacy return values) is
// guarded by the same flag and unchanged.
const DEV = Boolean(import.meta.env?.DEV);

describe("useI18n — dev-mode missing-key warning", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    expect(DEV).toBe(true);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    cleanup();
  });

  it("warns once per missing key in the observable composable", () => {
    const useI18n = createUseI18nObservable({
      defined: { en: "Defined", zh: "已定义" },
    });
    const { t, dispose } = useI18n();

    try {
      expect(t("defined")).toBe("Defined");
      expect(warnSpy).not.toHaveBeenCalled();

      // Missing key keeps the legacy return (the key itself) and warns once.
      expect(t("composableMissingKeyFixture" as never)).toBe(
        "composableMissingKeyFixture",
      );
      expect(t("composableMissingKeyFixture" as never)).toBe(
        "composableMissingKeyFixture",
      );

      const missingKeyWarnings = warnSpy.mock.calls.filter((call) =>
        String(call[0]).includes('"composableMissingKeyFixture"'),
      );
      expect(missingKeyWarnings).toHaveLength(1);
      expect(String(missingKeyWarnings[0][0])).toContain("Missing translation key");
    } finally {
      dispose();
    }
  });

  it("warns once per missing key in the React hook", () => {
    const useI18nHook = createUseI18nReact({
      defined: { en: "Defined", zh: "已定义" },
    });

    function Probe() {
      const { t } = useI18nHook();
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "defined" }, t("defined")),
        createElement(
          "span",
          { "data-testid": "missing" },
          t("reactMissingKeyFixture" as never),
        ),
        createElement(
          "span",
          { "data-testid": "missing-again" },
          t("reactMissingKeyFixture" as never),
        ),
      );
    }

    render(createElement(Probe));

    expect(screen.getByTestId("defined").textContent).toBe("Defined");
    // Dev keeps rendering the key itself so the gap is visible on screen.
    expect(screen.getByTestId("missing").textContent).toBe("reactMissingKeyFixture");

    const missingKeyWarnings = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes('"reactMissingKeyFixture"'),
    );
    expect(missingKeyWarnings).toHaveLength(1);
    expect(String(missingKeyWarnings[0][0])).toContain("Missing translation key");
  });
});
