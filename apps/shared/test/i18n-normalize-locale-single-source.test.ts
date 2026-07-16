/**
 * Guard: normalizeLocale has exactly one implementation in the shared layer.
 *
 * Background — the defect this pins shut:
 * `apps/shared/composables/useI18n.ts` used to declare its own local
 * `normalizeLocale` that mapped every non-"zh" input to "en", including "ja".
 * That module seeds its shared locale from `getLocale()` (utils/i18n), which
 * resolves "ja" natively. So the module contradicted itself: a first paint could
 * settle on "ja" while every later `setLocale("ja")` / languageChange event
 * downgraded it to "en".
 *
 * The platform genuinely supports ja — `Locale` includes it, `getLocale()`
 * resolves it (see i18n-locale.test.ts), and gas-lucky-pool ships a full ja
 * catalog rendered through react/hooks/useI18n. So utils/i18n is the correct
 * behaviour and the single source of truth; every other module must import it.
 *
 * These tests exist so a third copy cannot quietly appear, and so nobody
 * "simplifies" utils/i18n back to a zh/en-only branch.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { normalizeLocale } from "../utils/i18n";

const repoRoot = path.resolve(process.cwd(), "..", "..");
const sharedRoot = path.join(repoRoot, "apps", "shared");

/** The one and only file allowed to declare normalizeLocale. */
const SOURCE_OF_TRUTH = path.join("utils", "i18n.ts");

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", "test"]);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

// Matches a *declaration* of normalizeLocale (const/let/function), not a call
// site and not an `import { normalizeLocale }`.
const DECLARATION = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var|function)\s+normalizeLocale\b/;

describe("normalizeLocale single source of truth", () => {
  it("is declared in exactly one shared file (utils/i18n.ts)", () => {
    const declaringFiles = collectSourceFiles(sharedRoot)
      .filter((file) => DECLARATION.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(sharedRoot, file));

    expect(declaringFiles).toEqual([SOURCE_OF_TRUTH]);
  });

  it("is imported, not re-implemented, by every other shared consumer", () => {
    const consumers = collectSourceFiles(sharedRoot).filter((file) => {
      if (path.relative(sharedRoot, file) === SOURCE_OF_TRUTH) return false;
      return /\bnormalizeLocale\b/.test(readFileSync(file, "utf8"));
    });

    // Whoever mentions normalizeLocale must pull it from utils/i18n.
    for (const file of consumers) {
      const source = readFileSync(file, "utf8");
      expect(
        /import\s*\{[^}]*\bnormalizeLocale\b[^}]*\}\s*from\s*["'][^"']*utils\/i18n["']/s.test(
          source,
        ),
        `${path.relative(sharedRoot, file)} must import normalizeLocale from utils/i18n`,
      ).toBe(true);
    }
  });

  it("resolves ja natively — the platform supports it, do not collapse to zh/en", () => {
    expect(normalizeLocale("ja")).toBe("ja");
    expect(normalizeLocale("ja-JP")).toBe("ja");
  });

  it("still resolves zh and falls back to en for unsupported input", () => {
    expect(normalizeLocale("zh")).toBe("zh");
    expect(normalizeLocale("zh-CN")).toBe("zh");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("fr-FR")).toBe("en");
    expect(normalizeLocale(null)).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });
});

describe("composable useI18n honours every locale utils/i18n resolves", () => {
  const catalog = {
    greeting: { en: "Hello", zh: "你好", ja: "こんにちは" },
  };

  // Regression: pre-convergence the composable's local normalizeLocale mapped
  // "ja" -> "en", so setLocale("ja") rendered English while a getLocale()-seeded
  // first paint had already resolved "ja". These assertions fail against that
  // implementation and pass against the converged one.
  it("renders ja after setLocale('ja') instead of downgrading to en", async () => {
    const { createUseI18n } = await import("../composables/useI18n");
    const i18n = createUseI18n(catalog)();

    i18n.setLocale("ja");
    expect(i18n.locale.get()).toBe("ja");
    expect(i18n.t("greeting")).toBe("こんにちは");

    i18n.dispose();
  });

  it("keeps regional ja/zh tags resolving to their catalogs", async () => {
    const { createUseI18n } = await import("../composables/useI18n");
    const i18n = createUseI18n(catalog)();

    i18n.setLocale("ja-JP");
    expect(i18n.t("greeting")).toBe("こんにちは");

    i18n.setLocale("zh-CN");
    expect(i18n.t("greeting")).toBe("你好");

    i18n.setLocale("fr-FR");
    expect(i18n.t("greeting")).toBe("Hello");

    i18n.dispose();
  });
});
