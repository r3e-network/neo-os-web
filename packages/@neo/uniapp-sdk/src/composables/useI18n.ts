import { ref, computed, onMounted } from "vue";
import { waitForSDK } from "../bridge";

export type Locale = "en" | "zh";

/** Valid locale values for validation */
const VALID_LOCALES: readonly Locale[] = ["en", "zh"] as const;

function isValidLocale(value: unknown): value is Locale {
  return typeof value === "string" && VALID_LOCALES.includes(value as Locale);
}

/**
 * Global locale state - shared across all composable instances
 * This ensures consistent locale across the entire MiniApp
 */
const currentLocale = ref<Locale>("en");
let initialized = false;

/**
 * Reset i18n state - useful for testing and HMR scenarios
 * @internal
 */
export function resetI18nState(): void {
  initialized = false;
  currentLocale.value = "en";
}

export function useI18n(appId: string) {
  // Get locale from host platform
  const initLocale = async () => {
    if (initialized) return;
    initialized = true;

    try {
      const sdk = await waitForSDK();
      const result = (await sdk.invoke("getLocale", { appId })) as { locale?: string } | null;
      if (result?.locale && isValidLocale(result.locale)) {
        currentLocale.value = result.locale;
      }
    } catch {
      // Fallback to localStorage with validation (SSR-safe)
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("lang");
        if (isValidLocale(stored)) {
          currentLocale.value = stored;
        }
      }
    }
  };

  // Initialize on mount (proper async handling)
  onMounted(() => {
    initLocale();
  });

  const locale = computed(() => currentLocale.value);

  const setLocale = async (newLocale: Locale) => {
    currentLocale.value = newLocale;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("lang", newLocale);
    }
    try {
      const sdk = await waitForSDK();
      await sdk.invoke("setLocale", { appId, locale: newLocale });
    } catch {
      // Silent fail
    }
  };

  return { locale, setLocale };
}
