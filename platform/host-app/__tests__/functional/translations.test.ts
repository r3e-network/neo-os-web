/**
 * Translation Completeness Tests
 * Validates that all UI strings are translated
 */

import enCommon from "@/lib/i18n/locales/en/common.json";
import zhCommon from "@/lib/i18n/locales/zh/common.json";
import enHost from "@/lib/i18n/locales/en/host.json";
import zhHost from "@/lib/i18n/locales/zh/host.json";

function getKeys(obj: object, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...getKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("Translation Completeness", () => {
  describe("Common Translations", () => {
    it("should have matching keys between en and zh common", () => {
      const enKeys = getKeys(enCommon).sort();
      const zhKeys = getKeys(zhCommon).sort();
      
      const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));
      const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
      
      expect(missingInZh).toEqual([]);
      expect(missingInEn).toEqual([]);
    });

    it("should have non-empty values for all common keys", () => {
      const enKeys = getKeys(enCommon);
      enKeys.forEach((key) => {
        const value = key.split(".").reduce((o: any, k) => o?.[k], enCommon);
        expect(value).toBeTruthy();
      });
    });
  });

  describe("Host Translations", () => {
    it("should have matching keys between en and zh host", () => {
      const enKeys = getKeys(enHost).sort();
      const zhKeys = getKeys(zhHost).sort();
      
      const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));
      const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
      
      expect(missingInZh).toEqual([]);
      expect(missingInEn).toEqual([]);
    });
  });

  describe("Translation Quality", () => {
    it("should not have placeholder text in translations", () => {
      const checkPlaceholders = (obj: object, lang: string) => {
        const keys = getKeys(obj);
        keys.forEach((key) => {
          const value = key.split(".").reduce((o: any, k) => o?.[k], obj);
          if (typeof value === "string") {
            expect(value.toLowerCase()).not.toContain("todo");
            expect(value.toLowerCase()).not.toContain("fixme");
            expect(value).not.toBe("...");
          }
        });
      };
      
      checkPlaceholders(enCommon, "en");
      checkPlaceholders(zhCommon, "zh");
    });
  });
});
