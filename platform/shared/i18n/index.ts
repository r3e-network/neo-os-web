/**
 * Shared i18n helpers for Neo MiniApp Platform (React-focused).
 */

export type Locale = "en" | "zh" | "ja" | "ko";
export const defaultLocale: Locale = "en";
export const locales: Locale[] = ["en", "zh", "ja", "ko"];

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

// Storage key for persisting locale preference
export const LOCALE_STORAGE_KEY = "neo-miniapp-locale";

/**
 * Get the current locale from storage or browser preference
 */
export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }

  // Check browser language
  const browserLang = navigator.language.split("-")[0];
  if (browserLang === "zh") return "zh";
  if (browserLang === "ja") return "ja";
  if (browserLang === "ko") return "ko";

  return defaultLocale;
}

/**
 * Store locale preference
 */
export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

/**
 * Simple interpolation for translation strings
 * Supports {key} placeholders
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return values[key]?.toString() ?? `{${key}}`;
  });
}

/**
 * Normalize a locale-like value to a supported locale.
 */
export function normalizeLocale(value?: string | null): Locale {
  if (!value) return defaultLocale;
  const lower = value.toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  return "en";
}

/**
 * MiniApps currently support English + Chinese only.
 */
export function getMiniappLocale(value?: string | null): "en" | "zh" {
  return normalizeLocale(value) === "zh" ? "zh" : "en";
}

/**
 * Get a localized field value for objects that store translated fields.
 * Falls back to the base field when a localized value is unavailable.
 */
export function getLocalizedField<T extends Record<string, unknown>>(
  item: T,
  field: string,
  locale?: string | null,
): string {
  const normalized = normalizeLocale(locale);
  if (normalized !== "en") {
    const localizedField = `${field}_${normalized}` as keyof T;
    const localizedValue = item[localizedField];
    if (localizedValue !== undefined && localizedValue !== null && localizedValue !== "") {
      return String(localizedValue);
    }
  }
  const baseValue = item[field as keyof T];
  return baseValue == null ? "" : String(baseValue);
}

export * from "./types";
