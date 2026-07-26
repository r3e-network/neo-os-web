import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME_ID,
  GAME_THEMES,
  THEME_ITEM_ASSET_COUNT,
  THEME_ITEM_COUNT,
  THEME_STORAGE_KEY,
  isGameThemeId,
  loadThemePref,
  saveThemePref,
  themeItem,
  themeOf,
} from "./themes";

describe("player-selectable themes", () => {
  it("continues the farm-kitchen cover art into the first playable theme", () => {
    expect(DEFAULT_THEME_ID).toBe("farm-kitchen");
  });

  it("ships exactly three complete, unique theme contracts", () => {
    expect(GAME_THEMES.map((theme) => theme.id)).toEqual([
      "fresh-market",
      "farm-kitchen",
      "night-market",
    ]);
    for (const theme of GAME_THEMES) {
      expect(theme.backdrop).toMatch(/^\.\/art\/theme-.+\.webp$/);
      expect(theme.mascot).toMatch(/^\.\/art\/mascot-.+\.webp$/);
      expect(theme.items).toHaveLength(THEME_ITEM_COUNT);
      expect(theme.items).toHaveLength(THEME_ITEM_ASSET_COUNT * 3);
      expect(new Set(theme.items.map((item, kind) => (
        `${item.nameKey}:${Math.floor(kind / THEME_ITEM_ASSET_COUNT) + 1}`
      ))).size).toBe(THEME_ITEM_COUNT);
      expect(new Set(theme.items.map((item) => item.nameKey)).size).toBe(THEME_ITEM_ASSET_COUNT);
      expect(theme.css.accent).not.toBe(theme.css.accentStrong);
      expect(new Set(theme.items.map((item) => item.sizeBand))).toEqual(
        new Set(["small", "medium", "large"]),
      );
      expect(new Set(theme.items.map((item) => item.silhouette)).size).toBeGreaterThanOrEqual(7);
      const familyCounts = new Map<string, number>();
      for (const item of theme.items) {
        familyCounts.set(item.lookalikeFamily, (familyCounts.get(item.lookalikeFamily) ?? 0) + 1);
      }
      expect(
        [...familyCounts.values()].filter((count) => count >= 2).length,
        `${theme.id} near-match families`,
      ).toBeGreaterThanOrEqual(4);
      const variants = theme.items.filter((item) => item.modelKind !== undefined);
      expect(variants).toHaveLength(36);
      for (const variantBank of [1, 2] as const) {
        const bank = theme.items.slice(
          variantBank * THEME_ITEM_ASSET_COUNT,
          (variantBank + 1) * THEME_ITEM_ASSET_COUNT,
        );
        expect(new Set(bank.map((item) => item.modelKind)).size).toBe(THEME_ITEM_ASSET_COUNT);
        expect(bank.map((item) => item.modelKind)).toEqual(
          Array.from({ length: THEME_ITEM_ASSET_COUNT }, (_, baseKind) => baseKind),
        );
      }
      for (const item of variants) {
        expect(item.modelKind).toBeGreaterThanOrEqual(0);
        expect(item.modelKind).toBeLessThan(THEME_ITEM_ASSET_COUNT);
        expect(item.assetKind).toBe(item.modelKind);
        expect(item.variantIndex === 1 || item.variantIndex === 2).toBe(true);
        expect(item.chipHueDeg).toBe(0);
      }
      for (let baseKind = 0; baseKind < THEME_ITEM_ASSET_COUNT; baseKind += 1) {
        const family = theme.items.filter((item, kind) => (
          kind === baseKind || item.modelKind === baseKind
        ));
        expect(family, `${theme.id}/${baseKind} exact-silhouette family`).toHaveLength(3);
        expect(new Set(family.map((item) => item.color)).size).toBe(3);
        const distances: number[] = [];
        for (let left = 0; left < family.length; left += 1) {
          for (let right = left + 1; right < family.length; right += 1) {
            const a = family[left]!.color;
            const b = family[right]!.color;
            distances.push(Math.hypot(
              ((a >> 16) & 0xff) - ((b >> 16) & 0xff),
              ((a >> 8) & 0xff) - ((b >> 8) & 0xff),
              (a & 0xff) - (b & 0xff),
            ));
          }
        }
        expect(
          Math.min(...distances),
          `${theme.id}/${baseKind} colourways must be visible as large blocks`,
        ).toBeGreaterThan(90);
      }
      for (const variantBank of [1, 2] as const) {
        const hues = theme.items.slice(
          variantBank * THEME_ITEM_ASSET_COUNT,
          (variantBank + 1) * THEME_ITEM_ASSET_COUNT,
        ).map((item) => {
          const r = (item.color >> 16) & 0xff;
          const g = (item.color >> 8) & 0xff;
          const b = item.color & 0xff;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          if (delta === 0) return 0;
          const raw = max === r
            ? ((g - b) / delta) % 6
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4;
          return ((raw * 60 + 360) % 360);
        });
        const hueBuckets = new Set(hues.map((hue) => Math.floor(hue / 30)));
        expect(
          hueBuckets.size,
          `${theme.id} variant bank ${variantBank} must not collapse into one palette`,
        ).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("falls back safely for malformed ids and kinds", () => {
    expect(themeOf("missing").id).toBe(DEFAULT_THEME_ID);
    expect(themeItem("missing", 99)).toEqual(themeOf(DEFAULT_THEME_ID).items[0]);
    expect(isGameThemeId("night-market")).toBe(true);
    expect(isGameThemeId("night")).toBe(false);
  });

  it("persists only valid theme ids", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    saveThemePref("farm-kitchen");
    expect(store.get(THEME_STORAGE_KEY)).toBe("farm-kitchen");
    expect(loadThemePref()).toBe("farm-kitchen");
    store.set(THEME_STORAGE_KEY, "tampered");
    expect(loadThemePref()).toBe(DEFAULT_THEME_ID);
    vi.unstubAllGlobals();
  });
});
