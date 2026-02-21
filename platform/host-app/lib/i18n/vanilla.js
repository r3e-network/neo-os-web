/**
 * Lightweight i18n for vanilla JS MiniApps
 */

const LOCALE_KEY = "neo-miniapp-locale";
const DEFAULT_LOCALE = "en";

let currentLocale = DEFAULT_LOCALE;
let translations = {};

export function initI18n(localeData) {
  translations = localeData;
  currentLocale = getStoredLocale();
  return currentLocale;
}

export function getStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && translations[stored]) return stored;
    const browserLang = navigator.language.split("-")[0];
    if (browserLang === "zh" && translations.zh) return "zh";
  } catch (e) {}
  return DEFAULT_LOCALE;
}

export function setLocale(locale) {
  if (translations[locale]) {
    currentLocale = locale;
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    return true;
  }
  return false;
}

export function getLocale() {
  return currentLocale;
}

export function t(key, ns = "common") {
  const keys = key.split(".");
  let value = translations[currentLocale]?.[ns];
  for (const k of keys) {
    if (value && typeof value === "object") {
      value = value[k];
    } else {
      return key;
    }
  }
  return typeof value === "string" ? value : key;
}

export function toggleLocale() {
  const newLocale = currentLocale === "en" ? "zh" : "en";
  setLocale(newLocale);
  return newLocale;
}
