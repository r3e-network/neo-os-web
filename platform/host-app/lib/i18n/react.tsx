"use client";

import { createI18n } from "../../../shared/i18n/react";
import type { Locale} from "./index";
import { defaultLocale, getStoredLocale, localeNames, locales, setStoredLocale } from "./index";

// Import translations
import enCommon from "./locales/en/common.json";
import enHost from "./locales/en/host.json";
import enMiniapp from "./locales/en/miniapp.json";
import zhCommon from "./locales/zh/common.json";
import zhHost from "./locales/zh/host.json";
import zhMiniapp from "./locales/zh/miniapp.json";
import enAdmin from "../../../shared/i18n/locales/en/admin.json";
import zhAdmin from "../../../shared/i18n/locales/zh/admin.json";

const translations = {
  en: { common: enCommon, host: enHost, admin: enAdmin, miniapp: enMiniapp },
  zh: { common: zhCommon, host: zhHost, admin: zhAdmin, miniapp: zhMiniapp },
};

const hostAppI18n = createI18n<Locale>({
  defaultLocale,
  locales,
  localeNames,
  getStoredLocale,
  setStoredLocale,
  translations,
});

export const I18nProvider = hostAppI18n.I18nProvider;
export const useI18n = hostAppI18n.useI18n;
export const useTranslation = hostAppI18n.useTranslation;
