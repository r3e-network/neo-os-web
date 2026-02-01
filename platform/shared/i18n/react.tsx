"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Locale, defaultLocale, getStoredLocale, localeNames, locales, setStoredLocale } from "./index";

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

export type TranslationNamespace = "common" | "host" | "admin" | "miniapp";

type TranslationSet = Record<TranslationNamespace, Record<string, unknown>>;
type TranslationCatalog<LocaleType extends string> = Record<LocaleType, TranslationSet>;

export interface I18nContextType<LocaleType extends string> {
  locale: LocaleType;
  locales: readonly LocaleType[];
  localeNames: Record<LocaleType, string>;
  setLocale: (locale: LocaleType) => void;
  t: (key: string, ns?: TranslationNamespace, options?: Record<string, string | number>) => string;
}

export interface I18nConfig<LocaleType extends string> {
  defaultLocale: LocaleType;
  locales: readonly LocaleType[];
  localeNames: Record<LocaleType, string>;
  getStoredLocale: () => LocaleType;
  setStoredLocale: (locale: LocaleType) => void;
  translations: TranslationCatalog<LocaleType>;
}

export function createI18n<LocaleType extends string>(config: I18nConfig<LocaleType>) {
  const I18nContext = createContext<I18nContextType<LocaleType> | undefined>(undefined);

  const defaultT = (key: string): string => key;

  function I18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<LocaleType>(config.defaultLocale);

    useEffect(() => {
      setLocaleState(config.getStoredLocale());
    }, []);

    const setLocale = useCallback((newLocale: LocaleType) => {
      setLocaleState(newLocale);
      config.setStoredLocale(newLocale);
      if (typeof document !== "undefined") {
        document.documentElement.lang = newLocale;
      }
    }, []);

    const t = useCallback(
      (key: string, ns: TranslationNamespace = "common", options?: Record<string, string | number>): string => {
        const localeTranslations =
          config.translations[locale] ?? config.translations[config.defaultLocale];
        let value: unknown = localeTranslations?.[ns];

        for (const k of key.split(".")) {
          if (value && typeof value === "object") {
            value = (value as Record<string, unknown>)[k];
          } else {
            return key;
          }
        }

        if (typeof value !== "string") {
          return key;
        }

        if (!options) {
          return value;
        }

        return Object.entries(options).reduce(
          (result, [optionKey, optionValue]) =>
            result.replace(new RegExp(`{${optionKey}}`, "g"), String(optionValue)),
          value,
        );
      },
      [locale],
    );

    return (
      <I18nContext.Provider
        value={{
          locale,
          locales: config.locales,
          localeNames: config.localeNames,
          setLocale,
          t,
        }}
      >
        {children}
      </I18nContext.Provider>
    );
  }

  function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
      return {
        locale: config.defaultLocale,
        locales: config.locales,
        localeNames: config.localeNames,
        setLocale: () => {},
        t: defaultT,
      };
    }
    return context;
  }

  function useTranslation(ns: TranslationNamespace = "common") {
    const { t, locale, locales: availableLocales, localeNames: availableLocaleNames, setLocale } = useI18n();
    const translate = useCallback(
      (key: string, options?: Record<string, string | number>) => t(key, ns, options),
      [t, ns],
    );
    return {
      t: translate,
      locale,
      locales: availableLocales,
      localeNames: availableLocaleNames,
      setLocale,
    };
  }

  return { I18nProvider, useI18n, useTranslation };
}

const sharedI18n = createI18n<Locale>({
  defaultLocale,
  locales,
  localeNames,
  getStoredLocale,
  setStoredLocale,
  translations,
});

export const I18nProvider = sharedI18n.I18nProvider;
export const useI18n = sharedI18n.useI18n;
export const useTranslation = sharedI18n.useTranslation;
