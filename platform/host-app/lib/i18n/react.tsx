"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Locale, defaultLocale, getStoredLocale, setStoredLocale } from "./index";

// Import translations
import enCommon from "./locales/en/common.json";
import enHost from "./locales/en/host.json";
import enAdmin from "./locales/en/admin.json";
import enMiniapp from "./locales/en/miniapp.json";
import zhCommon from "./locales/zh/common.json";
import zhHost from "./locales/zh/host.json";
import zhAdmin from "./locales/zh/admin.json";
import zhMiniapp from "./locales/zh/miniapp.json";

const translations = {
  en: { common: enCommon, host: enHost, admin: enAdmin, miniapp: enMiniapp },
  zh: { common: zhCommon, host: zhHost, admin: zhAdmin, miniapp: zhMiniapp },
};

type TranslationNamespace = "common" | "host" | "admin" | "miniapp";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, ns?: TranslationNamespace, options?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getStoredLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string, ns: TranslationNamespace = "common", options?: Record<string, string | number>): string => {
      const keys = key.split(".");
      let value: unknown = translations[locale][ns];

      for (const k of keys) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[k];
        } else {
          return key;
        }
      }

      if (typeof value === "string") {
        let result = value;
        if (options) {
          Object.entries(options).forEach(([k, v]) => {
            result = result.replace(new RegExp(`{${k}}`, "g"), String(v));
          });
        }
        return result;
      }

      return key;
    },
    [locale],
  );

  // Always provide context, but use default locale until mounted
  // This ensures children re-render when locale changes after mount
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

// Default translation function for SSR/SSG
const defaultT = (key: string): string => key;

export function useI18n() {
  const context = useContext(I18nContext);
  // Return default values during SSR/SSG when provider hasn't mounted
  if (!context) {
    return {
      locale: defaultLocale,
      setLocale: () => {},
      t: defaultT,
    };
  }
  return context;
}

export function useTranslation(ns: TranslationNamespace = "common") {
  const { t, locale, setLocale } = useI18n();
  const translate = useCallback(
    (key: string, options?: Record<string, string | number>) => t(key, ns, options),
    [t, ns],
  );
  return { t: translate, locale, setLocale };
}
