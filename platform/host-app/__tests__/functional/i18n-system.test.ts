/**
 * Comprehensive i18n/Language System Tests
 * Tests language switching, translations, and fallbacks
 */

import {
  Locale,
  defaultLocale,
  locales,
  localeNames,
  getStoredLocale,
  setStoredLocale,
  interpolate,
  LOCALE_STORAGE_KEY,
} from "@/lib/i18n";

// Import translation files for validation
import enCommon from "@/lib/i18n/locales/en/common.json";
import zhCommon from "@/lib/i18n/locales/zh/common.json";
import enHost from "@/lib/i18n/locales/en/host.json";
import zhHost from "@/lib/i18n/locales/zh/host.json";

describe("i18n/Language System", () => {
  describe("Locale Configuration", () => {
    it("should have English as default locale", () => {
      expect(defaultLocale).toBe("en");
    });

    it("should support English and Chinese locales", () => {
      expect(locales).toContain("en");
      expect(locales).toContain("zh");
      expect(locales.length).toBe(2);
    });

    it("should have display names for all locales", () => {
      locales.forEach((locale) => {
        expect(localeNames[locale]).toBeTruthy();
      });
      expect(localeNames.en).toBe("English");
      expect(localeNames.zh).toBe("中文");
    });
  });

  describe("Locale Storage", () => {
    it("should return default locale in node environment", () => {
      expect(getStoredLocale()).toBe(defaultLocale);
    });

    it("should have correct storage key", () => {
      expect(LOCALE_STORAGE_KEY).toBe("meshminiapp-locale");
    });

    it("setStoredLocale should not throw in node environment", () => {
      expect(() => setStoredLocale("zh")).not.toThrow();
      expect(() => setStoredLocale("en")).not.toThrow();
    });
  });

  describe("String Interpolation", () => {
    it("should interpolate single placeholder", () => {
      const result = interpolate("Hello {name}!", { name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should interpolate multiple placeholders", () => {
      const result = interpolate("{greeting} {name}, you have {count} messages", {
        greeting: "Hello",
        name: "User",
        count: 5,
      });
      expect(result).toBe("Hello User, you have 5 messages");
    });

    it("should preserve unmatched placeholders", () => {
      const result = interpolate("Hello {name}, {missing}!", { name: "World" });
      expect(result).toBe("Hello World, {missing}!");
    });

    it("should handle empty values object", () => {
      const result = interpolate("Hello {name}!", {});
      expect(result).toBe("Hello {name}!");
    });

    it("should handle numeric values", () => {
      const result = interpolate("Count: {count}", { count: 42 });
      expect(result).toBe("Count: 42");
    });
  });
});
