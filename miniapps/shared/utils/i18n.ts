/**
 * i18n utilities for miniapps
 */

export type Locale = "en" | "zh";

export type TranslationEntry = { en: string; zh: string } | string;

export type TranslationMap = Record<string, TranslationEntry>;

/**
 * Get the current locale from the browser or default to 'en'
 */
export function getLocale(): Locale {
  if (typeof window === "undefined") return "en";

  const lang = navigator.language || (navigator as any).userLanguage || "en";
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}
