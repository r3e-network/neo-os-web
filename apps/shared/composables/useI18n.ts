import { ref } from "vue";
import { getLocale, type Locale, type TranslationMap } from "../utils/i18n";
import { commonMessages } from "../locale/common";
import { baseMessages } from "../locale/base-messages";

type InterpolationArgs = Record<string, string | number>;

type BaseMessages = typeof baseMessages;
type MergedMessages<T extends TranslationMap> = BaseMessages & T;

const normalizeLocale = (lang?: string | null): Locale => {
  if (!lang) return "en";
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
};

const interpolate = (value: string, args: InterpolationArgs): string =>
  value.replace(/\{(\w+)\}/g, (_, key) => String(args[key] ?? `{${key}}`));

export function createUseI18n<T extends TranslationMap>(messages: T) {
  // Base messages provide defaults; app-specific messages override on conflict
  const mergedMessages = {
    ...baseMessages,
    ...messages,
  } as MergedMessages<T>;
  const currentLocale = ref<Locale>(getLocale());

  const t = (key: keyof MergedMessages<T>, args?: InterpolationArgs) => {
    const entry = mergedMessages[key];
    if (!entry) return String(key);

    let str = "";
    if (typeof entry === "string") {
      str = entry;
    } else {
      str = entry[currentLocale.value] || entry.en || entry.zh || String(key);
    }

    return args ? interpolate(str, args) : str;
  };

  const setLocale = (lang: string) => {
    currentLocale.value = normalizeLocale(lang);
  };

  // Automatically listen for language changes from the host app
  if (typeof window !== "undefined") {
    window.addEventListener("languageChange", (event: Event) => {
      const newLang = (event as CustomEvent<{ language?: string }>).detail?.language;
      if (newLang) {
        setLocale(newLang);
      }
    });

    const expectedOrigin = (() => {
      try {
        if (window.parent !== window && document.referrer) {
          return new URL(document.referrer).origin;
        }
      } catch {
        // ignore parsing errors
      }
      return window.location.origin;
    })();

    window.addEventListener("message", (event: MessageEvent) => {
      const isParentMessage = event.source === window.parent;
      const isAllowedOrigin =
        event.origin === expectedOrigin ||
        event.origin === window.location.origin ||
        (isParentMessage && (event.origin === "null" || expectedOrigin === "null"));

      if (!isAllowedOrigin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "language-change") return;
      const newLang = String(data.language || data.locale || data.lang || "").trim();
      if (!newLang) return;
      setLocale(newLang);
    });
  }

  return () => ({
    locale: currentLocale,
    t,
    setLocale,
  });
}

// Export a pre-configured useI18n for shared components using commonMessages
export const useI18n = createUseI18n(commonMessages);
