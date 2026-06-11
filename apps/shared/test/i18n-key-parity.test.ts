import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { messages as selfLoanMessages } from "../../self-loan/src/locale/messages";
import { messages as milestoneEscrowMessages } from "../../milestone-escrow/src/locale/messages";

/**
 * Diff static t("key") usages against the app's merged locale map.
 *
 * The React i18n hook renders missing keys as "" in production, so a key that
 * compiles but is absent from the locale produces blank labels and — worse —
 * `throw new Error(t("missingKey"))` becomes an EMPTY error toast (the
 * self-loan walletStatusIdle/missingContract regression). This guard keeps
 * every statically-referenced key resolvable for the audited apps.
 */

const APPS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const T_CALL_PATTERN = /\bt\(\s*["']([A-Za-z0-9_.-]+)["']/g;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectUsedKeys(appName: string): string[] {
  const keys = new Set<string>();
  for (const file of collectSourceFiles(path.join(APPS_DIR, appName, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(T_CALL_PATTERN)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function missingKeys(appName: string, messages: Record<string, unknown>): string[] {
  return collectUsedKeys(appName).filter((key) => !(key in messages));
}

describe("i18n key parity", () => {
  it("self-loan defines every statically-referenced t() key (incl. walletStatusIdle/missingContract error keys)", () => {
    expect(missingKeys("self-loan", selfLoanMessages)).toEqual([]);
    // The error paths that previously threw Error("") must stay resolvable.
    const localized = selfLoanMessages as Record<string, { en: string; zh?: string }>;
    expect(localized.walletStatusIdle.en).toBe("Wallet not connected");
    expect(localized.walletStatusIdle.zh).toBeTruthy();
    expect(localized.missingContract.en).toBe("Contract not configured");
    expect(localized.missingContract.zh).toBeTruthy();
  });

  it("milestone-escrow defines every statically-referenced t() key with zh translations for the create form", () => {
    expect(missingKeys("milestone-escrow", milestoneEscrowMessages)).toEqual([]);
    // The four form keys previously papered over with English literals.
    const localized = milestoneEscrowMessages as Record<string, { en: string; zh?: string }>;
    for (const key of ["beneficiaryAddress", "description", "descriptionPlaceholder", "submit"]) {
      expect(localized[key]?.en, key).toBeTruthy();
      expect(localized[key]?.zh, key).toBeTruthy();
    }
  });
});
