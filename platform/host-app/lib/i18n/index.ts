/**
 * Shared i18n library for Neo MiniApp Platform
 * Supports both React (Next.js) and vanilla JS applications
 */

export type Locale = "en" | "zh";
export const defaultLocale: Locale = "en";
export const locales: Locale[] = ["en", "zh"];

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

// Storage key for persisting locale preference
export const LOCALE_STORAGE_KEY = "neo-miniapp-locale";

/**
 * Get the current locale from storage (user preference only)
 * Does not auto-detect browser language - defaults to English
 */
export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }

  // Default to English, let user change manually
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

export * from "./types";
