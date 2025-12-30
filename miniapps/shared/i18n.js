/**
 * Lightweight i18n for vanilla JS MiniApps
 * Usage: Include this file and call initI18n() with translations
 */

const LOCALE_KEY = "neo-miniapp-locale";

const MiniAppI18n = {
  locale: "en",
  translations: {},

  init(localeData) {
    this.translations = localeData;
    this.locale = this.getStoredLocale();
    this.updateUI();
    return this.locale;
  },

  getStoredLocale() {
    try {
      const stored = localStorage.getItem(LOCALE_KEY);
      if (stored && this.translations[stored]) return stored;
      const lang = navigator.language.split("-")[0];
      if (lang === "zh" && this.translations.zh) return "zh";
    } catch (e) {}
    return "en";
  },

  setLocale(locale) {
    if (this.translations[locale]) {
      this.locale = locale;
      localStorage.setItem(LOCALE_KEY, locale);
      document.documentElement.lang = locale;
      this.updateUI();
      return true;
    }
    return false;
  },

  toggle() {
    const newLocale = this.locale === "en" ? "zh" : "en";
    this.setLocale(newLocale);
    return newLocale;
  },

  t(key) {
    const keys = key.split(".");
    let value = this.translations[this.locale];
    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        return key;
      }
    }
    return typeof value === "string" ? value : key;
  },

  updateUI() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = this.t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = this.t(key);
    });
  },
};

window.MiniAppI18n = MiniAppI18n;
