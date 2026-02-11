import {
  interpolate,
  normalizeLocale,
  getMiniappLocale,
  getLocalizedField,
  defaultLocale,
  locales,
  localeNames,
  LOCALE_STORAGE_KEY,
} from "../i18n/index";
import type { Locale } from "../i18n/index";

describe("i18n constants", () => {
  it("has correct default locale", () => {
    expect(defaultLocale).toBe("en");
  });

  it("has all supported locales", () => {
    expect(locales).toEqual(["en", "zh", "ja", "ko"]);
  });

  it("has locale names for all locales", () => {
    for (const locale of locales) {
      expect(localeNames[locale]).toBeDefined();
      expect(typeof localeNames[locale]).toBe("string");
    }
  });

  it("has a storage key defined", () => {
    expect(LOCALE_STORAGE_KEY).toBe("neo-miniapp-locale");
  });
});

describe("interpolate", () => {
  it("replaces single placeholder", () => {
    expect(interpolate("Hello {name}", { name: "World" })).toBe("Hello World");
  });

  it("replaces multiple placeholders", () => {
    expect(interpolate("{a} + {b} = {c}", { a: 1, b: 2, c: 3 })).toBe("1 + 2 = 3");
  });

  it("preserves unmatched placeholders", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
  });

  it("handles numeric values", () => {
    expect(interpolate("Count: {n}", { n: 42 })).toBe("Count: 42");
  });

  it("returns template unchanged when no placeholders", () => {
    expect(interpolate("No placeholders here", { key: "val" })).toBe("No placeholders here");
  });

  it("handles empty template", () => {
    expect(interpolate("", { key: "val" })).toBe("");
  });
});

describe("normalizeLocale", () => {
  it("returns 'en' for null/undefined/empty", () => {
    expect(normalizeLocale(null)).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
    expect(normalizeLocale("")).toBe("en");
  });

  it("normalizes Chinese locale variants", () => {
    expect(normalizeLocale("zh")).toBe("zh");
    expect(normalizeLocale("zh-CN")).toBe("zh");
    expect(normalizeLocale("zh-TW")).toBe("zh");
    expect(normalizeLocale("ZH")).toBe("zh");
  });

  it("normalizes Japanese locale variants", () => {
    expect(normalizeLocale("ja")).toBe("ja");
    expect(normalizeLocale("ja-JP")).toBe("ja");
    expect(normalizeLocale("JA")).toBe("ja");
  });

  it("normalizes Korean locale variants", () => {
    expect(normalizeLocale("ko")).toBe("ko");
    expect(normalizeLocale("ko-KR")).toBe("ko");
    expect(normalizeLocale("KO")).toBe("ko");
  });

  it("falls back to 'en' for unsupported locales", () => {
    expect(normalizeLocale("fr")).toBe("en");
    expect(normalizeLocale("de")).toBe("en");
    expect(normalizeLocale("en-US")).toBe("en");
  });
});

describe("getMiniappLocale", () => {
  it("returns 'zh' for Chinese locales", () => {
    expect(getMiniappLocale("zh")).toBe("zh");
    expect(getMiniappLocale("zh-CN")).toBe("zh");
  });

  it("returns 'en' for all non-Chinese locales", () => {
    expect(getMiniappLocale("en")).toBe("en");
    expect(getMiniappLocale("ja")).toBe("en");
    expect(getMiniappLocale("ko")).toBe("en");
    expect(getMiniappLocale("fr")).toBe("en");
  });

  it("returns 'en' for null/undefined", () => {
    expect(getMiniappLocale(null)).toBe("en");
    expect(getMiniappLocale(undefined)).toBe("en");
  });
});

describe("getLocalizedField", () => {
  const item = {
    name: "Test App",
    name_zh: "测试应用",
    name_ja: "テストアプリ",
    description: "A test app",
    description_zh: "",
    title: "My Title",
  };

  it("returns base field for English locale", () => {
    expect(getLocalizedField(item, "name", "en")).toBe("Test App");
  });

  it("returns localized field when available", () => {
    expect(getLocalizedField(item, "name", "zh")).toBe("测试应用");
    expect(getLocalizedField(item, "name", "ja")).toBe("テストアプリ");
  });

  it("falls back to base field when localized value is empty string", () => {
    expect(getLocalizedField(item, "description", "zh")).toBe("A test app");
  });

  it("falls back to base field when localized field does not exist", () => {
    expect(getLocalizedField(item, "title", "zh")).toBe("My Title");
  });

  it("returns empty string when base field is null/undefined", () => {
    expect(getLocalizedField({ missing: null }, "missing", "en")).toBe("");
    expect(getLocalizedField({}, "nonexistent", "en")).toBe("");
  });

  it("defaults to English when locale is null/undefined", () => {
    expect(getLocalizedField(item, "name", null)).toBe("Test App");
    expect(getLocalizedField(item, "name", undefined)).toBe("Test App");
  });
});
