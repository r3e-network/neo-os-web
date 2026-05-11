import type { MiniAppInfo } from "@/components/types";
import type { Locale } from "@/lib/i18n";

type Dict = Record<string, unknown>;

export type TranslationNamespace = "common" | "host" | "admin" | "miniapp";
export type TranslationFn = (key: string, ns?: TranslationNamespace) => string;

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function localizedFieldKey(field: string, locale: Locale): string {
  return locale === "en" ? `${field}_en` : `${field}_${locale}`;
}

export function translateOrFallback(
  t: TranslationFn,
  key: string,
  ns: TranslationNamespace,
  fallback: string,
): string {
  const translated = t(key, ns);
  return translated === key ? fallback : translated;
}

function getLocalizedField(
  app: MiniAppInfo,
  field: string,
  locale: Locale,
  fallback: string,
): string {
  const appRecord = app as unknown as Dict;
  const manifest = asObject(app.manifest);
  const i18n = asObject(manifest.i18n);
  const localizedKey = localizedFieldKey(field, locale);
  const englishKey = `${field}_en`;
  const sources = [appRecord, i18n, manifest];

  for (const source of sources) {
    const localized = asString(source[localizedKey]);
    if (localized) return localized;
  }

  if (locale !== "en") {
    const zhKey = `${field}_zh`;
    for (const source of sources) {
      const localized = asString(source[zhKey]);
      if (localized) return localized;
    }
  }

  for (const source of sources) {
    const english = asString(source[englishKey]);
    if (english) return english;
  }

  return fallback;
}

export function getLocalizedMiniAppName(app: MiniAppInfo, locale: Locale): string {
  return getLocalizedField(app, "name", locale, app.name);
}

export function getLocalizedMiniAppDescription(
  app: MiniAppInfo,
  locale: Locale,
): string {
  return getLocalizedField(app, "description", locale, app.description);
}

export function getCategoryLabel(
  category: string,
  t: TranslationFn,
): string {
  return translateOrFallback(t, `categories.${category}`, "host", category);
}

export function getLocalizedMiniAppCategoryLabel(
  app: MiniAppInfo,
  locale: Locale,
  t: TranslationFn,
): string {
  const specific = getLocalizedField(app, "category_name", locale, "");
  return specific || getCategoryLabel(String(app.category), t);
}

export function getNetworkLabel(targetNetwork: string, t: TranslationFn): string {
  return targetNetwork === "testnet"
    ? t("catalog.network.testnet", "host")
    : t("catalog.network.mainnet", "host");
}

export function getAvailabilityLabel(
  tone: string,
  rawLabel: string,
  t: TranslationFn,
): string {
  if (tone === "live") return t("catalog.status.live", "host");
  if (tone === "pending") return t("catalog.status.pending", "host");
  if (tone === "tool") return t("catalog.status.tool", "host");
  if (rawLabel === "Testnet only") return t("catalog.status.testnetOnly", "host");
  if (rawLabel === "Mainnet only") return t("catalog.status.mainnetOnly", "host");
  if (rawLabel === "Network unavailable") {
    return t("catalog.status.networkUnavailable", "host");
  }
  return t("catalog.status.otherNetwork", "host");
}
