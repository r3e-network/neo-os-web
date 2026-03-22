import { ref, onUnmounted, onMounted } from "vue";
import { getLocale, type Locale, type TranslationMap } from "../utils/i18n";
import { commonMessages } from "../locale/common";
import { baseMessages } from "../locale/base-messages";

// Module-level state for shared locale and event listeners
let listenersRefCount = 0;
let languageChangeHandler: ((event: Event) => void) | null = null;
let messageHandler: ((event: MessageEvent) => void) | null = null;
const sharedLocale = ref<Locale>(getLocale());

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

  const t = (key: keyof MergedMessages<T>, args?: InterpolationArgs) => {
    const entry = mergedMessages[key];
    if (!entry) return String(key);

    let str = "";
    if (typeof entry === "string") {
      str = entry;
    } else {
      str = entry[sharedLocale.value] || entry.en || entry.zh || String(key);
    }

    return args ? interpolate(str, args) : str;
  };

  const setLocale = (lang: string) => {
    sharedLocale.value = normalizeLocale(lang);
  };

  // Register event listeners on first use
  if (typeof window !== "undefined") {
    if (listenersRefCount === 0) {
      languageChangeHandler = (event: Event) => {
        const newLang = (event as CustomEvent<{ language?: string }>).detail?.language;
        if (newLang) {
          sharedLocale.value = normalizeLocale(newLang);
        }
      };

      const expectedOrigin = (() => {
        try {
          if (window.parent !== window && document.referrer) {
            return new URL(document.referrer).origin;
          }
        } catch (_e: unknown) {
          // ignore parsing errors
        }
        return window.location.origin;
      })();

      messageHandler = (event: MessageEvent) => {
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
        sharedLocale.value = normalizeLocale(newLang);
      };

      window.addEventListener("languageChange", languageChangeHandler);
      window.addEventListener("message", messageHandler);
    }
    listenersRefCount++;

    onUnmounted(() => {
      listenersRefCount--;
      if (listenersRefCount === 0 && languageChangeHandler && messageHandler) {
        window.removeEventListener("languageChange", languageChangeHandler);
        window.removeEventListener("message", messageHandler);
        languageChangeHandler = null;
        messageHandler = null;
      }
    });
  }

  return () => ({
    locale: sharedLocale,
    t,
    setLocale,
  });
}

// Export a pre-configured useI18n for shared components using commonMessages
export const useI18n = createUseI18n(commonMessages);
