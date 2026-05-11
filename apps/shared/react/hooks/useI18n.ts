/**
 * useI18n — React hook for internationalization
 *
 * React equivalent of the Vue composable in composables/useI18n.ts.
 * Provides a `t()` translation function that resolves i18n keys
 * against merged base + app-specific messages, with locale auto-detection
 * and host language change support.
 *
 * @example
 * ```tsx
 * const { t, locale, setLocale } = useI18n(appMessages);
 * return <h1>{t("title")}</h1>;
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getLocale,
  normalizeLocale,
  type Locale,
  type TranslationMap,
} from "../../utils/i18n";
import { commonMessages } from "../../locale/common";
import { baseMessages } from "../../locale/base-messages";
import { getHostOrigin } from "../../utils/runtime-origin";

type InterpolationArgs = Record<string, string | number>;

type BaseMessages = typeof baseMessages;
type MergedMessages<T extends TranslationMap> = BaseMessages & T;

const interpolate = (value: string, args: InterpolationArgs): string =>
  value.replace(/\{(\w+)\}/g, (_, key) => String(args[key] ?? `{${key}}`));

// Module-level shared locale so all hook instances stay in sync
let sharedLocale: Locale = typeof window !== "undefined" ? getLocale() : "en";
const localeListeners = new Set<() => void>();

function setSharedLocale(lang: Locale) {
  if (sharedLocale === lang) return;
  sharedLocale = lang;
  localeListeners.forEach((fn) => fn());
}

// Module-level event listener registration (ref-counted like the Vue version)
let listenersRefCount = 0;
let languageChangeHandler: ((event: Event) => void) | null = null;
let messageHandler: ((event: MessageEvent) => void) | null = null;

function addGlobalListeners() {
  if (typeof window === "undefined") return;
  if (listenersRefCount === 0) {
    languageChangeHandler = (event: Event) => {
      const newLang = (event as CustomEvent<{ language?: string }>).detail
        ?.language;
      if (newLang) {
        setSharedLocale(normalizeLocale(newLang));
      }
    };

    const expectedOrigin = getHostOrigin();

    messageHandler = (event: MessageEvent) => {
      const isParentMessage = event.source === window.parent;
      const isAllowedOrigin =
        event.origin === expectedOrigin ||
        event.origin === window.location.origin ||
        (isParentMessage &&
          (event.origin === "null" || expectedOrigin === "null"));

      if (!isAllowedOrigin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "language-change") return;
      const newLang = String(
        data.language || data.locale || data.lang || "",
      ).trim();
      if (!newLang) return;
      setSharedLocale(normalizeLocale(newLang));
    };

    window.addEventListener("languageChange", languageChangeHandler);
    window.addEventListener("message", messageHandler);
  }
  listenersRefCount++;
}

function removeGlobalListeners() {
  if (typeof window === "undefined") return;
  listenersRefCount--;
  if (listenersRefCount === 0 && languageChangeHandler && messageHandler) {
    window.removeEventListener("languageChange", languageChangeHandler);
    window.removeEventListener("message", messageHandler);
    languageChangeHandler = null;
    messageHandler = null;
  }
}

/**
 * Create a typed i18n hook for a specific set of messages.
 *
 * @param messages - App-specific translation map merged over base messages
 * @returns A React hook that provides { t, locale, setLocale }
 */
export function createUseI18n<T extends TranslationMap>(messages: T) {
  const mergedMessages = {
    ...baseMessages,
    ...messages,
  } as MergedMessages<T>;

  return function useI18nHook() {
    const [locale, setLocaleState] = useState<Locale>(sharedLocale);
    const mergedRef = useRef(mergedMessages);

    // Subscribe to shared locale changes
    useEffect(() => {
      addGlobalListeners();
      const listener = () => setLocaleState(sharedLocale);
      localeListeners.add(listener);
      return () => {
        localeListeners.delete(listener);
        removeGlobalListeners();
      };
    }, []);

    const t = useCallback(
      (key: keyof MergedMessages<T>, args?: InterpolationArgs): string => {
        const entry = mergedRef.current[key];
        if (!entry) return "";

        let str = "";
        if (typeof entry === "string") {
          str = entry;
        } else {
          str =
            entry[sharedLocale] || entry.en || entry.zh || entry.ja || "";
        }

        return args ? interpolate(str, args) : str;
      },
      // sharedLocale is module-level, so we use the state value to trigger re-render
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [locale],
    );

    const setLocale = useCallback((lang: string) => {
      setSharedLocale(normalizeLocale(lang));
    }, []);

    return { locale, t, setLocale };
  };
}

/** Pre-configured hook using common messages (for shared components) */
export const useI18n = createUseI18n(commonMessages);
