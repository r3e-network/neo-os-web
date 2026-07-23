import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME_ID,
  GAME_THEMES,
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
      expect(new Set(theme.items.map((item) => item.nameKey)).size).toBe(THEME_ITEM_COUNT);
      expect(theme.css.accent).not.toBe(theme.css.accentStrong);
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
