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
import jaCommon from "./locales/ja/common.json";
import jaHost from "./locales/ja/host.json";
import jaAdmin from "./locales/ja/admin.json";
import jaMiniapp from "./locales/ja/miniapp.json";
import koCommon from "./locales/ko/common.json";
import koHost from "./locales/ko/host.json";
import koAdmin from "./locales/ko/admin.json";
import koMiniapp from "./locales/ko/miniapp.json";

const translations = {
  en: { common: enCommon, host: enHost, admin: enAdmin, miniapp: enMiniapp },
  zh: { common: zhCommon, host: zhHost, admin: zhAdmin, miniapp: zhMiniapp },
  ja: { common: jaCommon, host: jaHost, admin: jaAdmin, miniapp: jaMiniapp },
  ko: { common: koCommon, host: koHost, admin: koAdmin, miniapp: koMiniapp },
};

type TranslationNamespace = "common" | "host" | "admin" | "miniapp";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, ns?: TranslationNamespace) => string;
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
    (key: string, ns: TranslationNamespace = "common"): string => {
      const keys = key.split(".");
      let value: unknown = translations[locale][ns];

      for (const k of keys) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[k];
        } else {
          return key;
        }
      }

      return typeof value === "string" ? value : key;
    },
    [locale],
  );

  if (!mounted) {
    return <>{children}</>;
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function useTranslation(ns: TranslationNamespace = "common") {
  const { t, locale, setLocale } = useI18n();
  const translate = useCallback((key: string) => t(key, ns), [t, ns]);
  return { t: translate, locale, setLocale };
}
