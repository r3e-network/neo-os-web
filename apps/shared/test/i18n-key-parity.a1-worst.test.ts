import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { messages as quadraticFundingMessages } from "../../quadratic-funding/src/locale/messages";
import { messages as gasLuckyPoolMessages } from "../../gas-lucky-pool/src/locale/messages";

/**
 * i18n key-parity guard for the a1-worst cluster (quadratic-funding,
 * gas-lucky-pool). Kept in a separate file from the main parity suite so the
 * concurrent cluster agents do not contend on one import block.
 *
 * Every statically-referenced t("key") must resolve in the app's merged locale
 * map — a missing key renders blank in production (and an empty error toast for
 * `throw new Error(t("missingKey"))`).
 */

const APPS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
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

describe("a1-worst i18n key parity", () => {
  it("quadratic-funding defines every statically-referenced t() key with zh translations", () => {
    expect(missingKeys("quadratic-funding", quadraticFundingMessages)).toEqual([]);
    const localized = quadraticFundingMessages as Record<string, { en: string; zh?: string }>;
    // The new admin-gated finalize + cancel + match-table keys must carry zh.
    for (const key of [
      "finalizeAdminOnly",
      "finalizeSuggested",
      "matchTableSuggested",
      "cancelRound",
      "invalidEndTime",
      "assetSelect",
    ]) {
      expect(localized[key]?.en, key).toBeTruthy();
      expect(localized[key]?.zh, key).toBeTruthy();
    }
  });

  it("gas-lucky-pool defines every statically-referenced t() key with en/zh/ja translations", () => {
    expect(missingKeys("gas-lucky-pool", gasLuckyPoolMessages)).toEqual([]);
    const localized = gasLuckyPoolMessages as Record<string, { en: string; zh?: string; ja?: string }>;
    for (const key of ["rewardRangeDefault", "vaultName"]) {
      expect(localized[key]?.en, key).toBeTruthy();
      expect(localized[key]?.zh, key).toBeTruthy();
      expect(localized[key]?.ja, key).toBeTruthy();
    }
  });
});
