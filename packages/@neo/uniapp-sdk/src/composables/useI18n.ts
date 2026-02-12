import { ref, computed, onMounted } from "vue";
import { PRODUCTION_ORIGINS, DEV_ORIGINS } from "../config";

export type Locale = "en" | "zh" | "ja" | "ko";

/** Allowed origins for postMessage-based locale changes */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([...PRODUCTION_ORIGINS, ...DEV_ORIGINS]);

/**
 * Global locale state - shared across all composable instances
 * This ensures consistent locale across the entire MiniApp
 */
const currentLocale = ref<Locale>("en");
let initialized = false;
let listenersAttached = false;

function normalizeLocale(value?: string | null): Locale {
  if (!value) return "en";
  const lower = value.toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  return "en";
}

function readQueryLocale(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("lang") || params.get("locale");
  } catch {
    return null;
  }
}

function resolveInitialLocale(): Locale {
  const queryLocale = readQueryLocale();
  if (queryLocale) return normalizeLocale(queryLocale);
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("lang");
    if (stored) return normalizeLocale(stored);
  }
  if (typeof navigator !== "undefined") {
    const candidate = navigator.language || navigator.languages?.[0];
    if (candidate) return normalizeLocale(candidate);
  }
  return "en";
}

/**
 * Reset i18n state - useful for testing and HMR scenarios
 * @internal
 */
export function resetI18nState(): void {
  initialized = false;
  listenersAttached = false;
  currentLocale.value = "en";
}

export function useI18n(appId: string) {
  void appId;
  // Initialize locale from URL/localStorage
  const initLocale = () => {
    if (initialized) return;
    initialized = true;

    currentLocale.value = resolveInitialLocale();
  };

  // Initialize on mount (proper async handling)
  onMounted(() => {
    initLocale();
    attachListeners();
  });

  const locale = computed(() => currentLocale.value);

  const setLocale = async (newLocale: Locale) => {
    currentLocale.value = newLocale;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("lang", newLocale);
    }
  };

  const attachListeners = () => {
    if (listenersAttached || typeof window === "undefined") return;
    listenersAttached = true;

    window.addEventListener("languageChange", (event: import("../types").LanguageChangeEvent) => {
      const next = event?.detail?.language;
      if (next) {
        currentLocale.value = normalizeLocale(String(next));
      }
    });

    window.addEventListener("message", (event: MessageEvent) => {
      // Only accept locale messages from known host origins
      if (!ALLOWED_ORIGINS.has(event.origin) && event.origin !== window.location.origin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "language-change") return;
      const next = String(data.language || data.locale || data.lang || "").trim();
      if (!next) return;
      currentLocale.value = normalizeLocale(next);
    });
  };

  return { locale, setLocale };
}
