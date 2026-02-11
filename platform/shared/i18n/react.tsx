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

export interface TranslationStringOptions {
  defaultValue?: string;
  returnObjects?: false | undefined;
  [key: string]: string | number | boolean | undefined;
}

export interface TranslationObjectOptions {
  defaultValue?: unknown;
  returnObjects: true;
  [key: string]: unknown;
}

export type TranslationOptions = TranslationStringOptions | TranslationObjectOptions;

export interface TranslationFunction {
  (key: string, ns?: TranslationNamespace): string;
  (key: string, ns: TranslationNamespace, options: TranslationObjectOptions): unknown;
  (key: string, ns: TranslationNamespace, options?: TranslationStringOptions): string;
}

export interface NamespaceTranslationFunction {
  (key: string): string;
  (key: string, options: TranslationObjectOptions): unknown;
  (key: string, options?: TranslationStringOptions): string;
}

type TranslationSet = Record<TranslationNamespace, Record<string, unknown>>;
type TranslationCatalog<LocaleType extends string> = Record<LocaleType, TranslationSet>;
type InterpolationValue = string | number | boolean;

function resolveNestedValue(root: unknown, key: string): unknown {
  let value = root;

  for (const segment of key.split(".")) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return value;
}

function getInterpolationValues(options?: TranslationOptions): Record<string, InterpolationValue> {
  if (!options) {
    return {};
  }

  const values: Record<string, InterpolationValue> = {};
  for (const [optionKey, optionValue] of Object.entries(options)) {
    if (optionKey === "defaultValue" || optionKey === "returnObjects") {
      continue;
    }

    if (
      typeof optionValue === "string" ||
      typeof optionValue === "number" ||
      typeof optionValue === "boolean"
    ) {
      values[optionKey] = optionValue;
    }
  }

  return values;
}

function interpolateValue(template: string, options?: TranslationOptions): string {
  const interpolationValues = getInterpolationValues(options);

  return Object.entries(interpolationValues).reduce(
    (result, [optionKey, optionValue]) =>
      result.replace(new RegExp(`{${optionKey}}`, "g"), String(optionValue)),
    template,
  );
}

export interface I18nContextType<LocaleType extends string> {
  locale: LocaleType;
  locales: readonly LocaleType[];
  localeNames: Record<LocaleType, string>;
  setLocale: (locale: LocaleType) => void;
  t: TranslationFunction;
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

  const defaultT: TranslationFunction = ((key: string) => key) as TranslationFunction;

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
      ((key: string, ns: TranslationNamespace = "common", options?: TranslationOptions): string | unknown => {
        const localeTranslations =
          config.translations[locale] ?? config.translations[config.defaultLocale];

        const resolvedValue = resolveNestedValue(localeTranslations?.[ns], key);
        const value = resolvedValue === undefined ? options?.defaultValue : resolvedValue;

        if (options?.returnObjects === true) {
          return value === undefined ? key : value;
        }

        if (typeof value === "string") {
          return interpolateValue(value, options);
        }

        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }

        return key;
      }) as TranslationFunction,
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
      ((key: string, options?: TranslationOptions) => (t as any)(key, ns, options)) as NamespaceTranslationFunction,
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
