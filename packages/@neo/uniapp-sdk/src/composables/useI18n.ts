import { ref, computed, onMounted } from "vue";

export type Locale = "en" | "zh";

/**
 * Global locale state - shared across all composable instances
 * This ensures consistent locale across the entire MiniApp
 */
const currentLocale = ref<Locale>("en");
let initialized = false;
let listenersAttached = false;

function normalizeLocale(value?: string | null): Locale {
  if (!value) return "en";
  return value.toLowerCase().startsWith("zh") ? "zh" : "en";
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

    window.addEventListener("languageChange", (event: any) => {
      const next = event?.detail?.language;
      if (next) {
        currentLocale.value = normalizeLocale(String(next));
      }
    });

    window.addEventListener("message", (event: MessageEvent) => {
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
