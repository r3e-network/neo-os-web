import { ref, computed } from "vue";
import { callBridge } from "../bridge";

export type Locale = "en" | "zh";

const currentLocale = ref<Locale>("en");

export function useI18n(appId: string) {
  // Get locale from host platform
  const initLocale = async () => {
    try {
      const result = await callBridge("getLocale", { appId });
      if (result?.locale) {
        currentLocale.value = result.locale as Locale;
      }
    } catch {
      // Fallback to localStorage
      const stored = localStorage.getItem("lang") as Locale;
      if (stored) currentLocale.value = stored;
    }
  };

  // Initialize on first call
  initLocale();

  const locale = computed(() => currentLocale.value);

  const setLocale = async (newLocale: Locale) => {
    currentLocale.value = newLocale;
    localStorage.setItem("lang", newLocale);
    try {
      await callBridge("setLocale", { appId, locale: newLocale });
    } catch {
      // Silent fail
    }
  };

  return { locale, setLocale };
}
