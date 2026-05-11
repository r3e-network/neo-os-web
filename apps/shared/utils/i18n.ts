/**
 * i18n utilities for miniapps
 */

export type Locale = "en" | "zh" | "ja";

export type TranslationEntry =
  | {
      en: string;
      zh?: string;
      ja?: string;
    }
  | string;

export type TranslationMap = Record<string, TranslationEntry>;

const LANGUAGE_QUERY_KEYS = [
  "lang",
  "locale",
  "language",
  "uiLang",
  "uiLocale",
  "onegateLang",
  "onegateLocale",
  "onegate_lang",
  "onegate_locale",
];

const PAYLOAD_QUERY_KEYS = [
  "launchParams",
  "launch_params",
  "onegate_params",
  "payload",
  "params",
];

function matchSupportedLocale(value?: string | null): Locale | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!raw) return null;
  if (raw === "zh" || raw.startsWith("zh-")) return "zh";
  if (raw === "ja" || raw.startsWith("ja-")) return "ja";
  if (raw === "en" || raw.startsWith("en-")) return "en";
  return null;
}

export function normalizeLocale(value?: string | null): Locale {
  return matchSupportedLocale(value) ?? "en";
}

function maybeDecodeJson(raw: string): unknown {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* ignore malformed encoded payloads */
  }
  if (/^[A-Za-z0-9_-]+={0,2}$/.test(raw) && raw.length >= 4) {
    try {
      const padded = raw
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(raw.length / 4) * 4, "=");
      candidates.push(atob(padded));
    } catch {
      /* ignore non-base64 payloads */
    }
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function readPayloadLocale(params: URLSearchParams): Locale | null {
  for (const payloadKey of PAYLOAD_QUERY_KEYS) {
    const raw = params.get(payloadKey);
    if (!raw) continue;
    const decoded = maybeDecodeJson(raw);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      continue;
    }
    const record = decoded as Record<string, unknown>;
    for (const key of LANGUAGE_QUERY_KEYS) {
      if (record[key]) return normalizeLocale(String(record[key]));
    }
  }
  return null;
}

function readParamLocale(params: URLSearchParams): Locale | null {
  for (const key of LANGUAGE_QUERY_KEYS) {
    if (params.has(key)) return normalizeLocale(params.get(key));
  }
  return readPayloadLocale(params);
}

function readUrlLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const searchLocale = readParamLocale(url.searchParams);
    if (searchLocale) return searchLocale;
    const queryIndex = url.hash.indexOf("?");
    if (queryIndex >= 0) {
      return readParamLocale(new URLSearchParams(url.hash.slice(queryIndex + 1)));
    }
  } catch {
    /* ignore invalid browser URL */
  }
  return null;
}

/**
 * Get the current locale from OneGate launch params or browser language.
 */
export function getLocale(): Locale {
  if (typeof window === "undefined") return "en";

  const urlLocale = readUrlLocale();
  if (urlLocale) return urlLocale;

  const nav = navigator as unknown as {
    language?: string;
    languages?: readonly string[];
    userLanguage?: string;
  };
  const languages = [
    ...(Array.isArray(nav.languages) ? nav.languages : []),
    nav.language,
    nav.userLanguage,
  ].filter(Boolean) as string[];

  for (const language of languages) {
    const locale = matchSupportedLocale(language);
    if (locale) return locale;
  }

  return "en";
}
