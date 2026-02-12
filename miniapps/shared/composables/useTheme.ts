/**
 * Theme Composable for Miniapps
 *
 * Provides theme switching and detection utilities for Vue components.
 *
 * @example
 * ```ts
 * import { useTheme } from "@shared/composables/useTheme";
 *
 * const { theme, isDark, isLight, setTheme, toggleTheme } = useTheme();
 * ```
 */

import { ref, computed, onMounted, watch } from "vue";

type ThemeMode = "dark" | "light" | "auto";
type ResolvedTheme = "dark" | "light";

/**
 * Theme composable for managing theme state
 */
export function useTheme(initialTheme?: ThemeMode) {
  // Get initial theme from localStorage or system preference
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const getStoredTheme = (): ThemeMode => {
    try {
      const stored = localStorage.getItem("miniapp-theme");
      if (stored === "dark" || stored === "light" || stored === "auto") {
        return stored;
      }
    } catch {
      /* localStorage unavailable (SSR or restricted context) */
    }
    return initialTheme || "auto";
  };

  const theme = ref<ThemeMode>(getStoredTheme());

  /**
   * Resolve the actual theme to apply (handles "auto" mode)
   */
  const resolvedTheme = computed<ResolvedTheme>(() => {
    if (theme.value === "auto") {
      return getSystemTheme();
    }
    return theme.value;
  });

  /**
   * Whether dark theme is active
   */
  const isDark = computed(() => resolvedTheme.value === "dark");

  /**
   * Whether light theme is active
   */
  const isLight = computed(() => resolvedTheme.value === "light");

  /**
   * Set the theme mode
   */
  const setTheme = (newTheme: ThemeMode) => {
    theme.value = newTheme;
    try {
      localStorage.setItem("miniapp-theme", newTheme);
    } catch {
      /* localStorage unavailable (SSR or restricted context) */
    }
    applyTheme(newTheme);
  };

  /**
   * Toggle between light and dark theme
   */
  const toggleTheme = () => {
    const newTheme: ThemeMode = isDark.value ? "light" : "dark";
    setTheme(newTheme);
  };

  /**
   * Apply theme to document
   */
  const applyTheme = (themeMode: ThemeMode) => {
    if (typeof document === "undefined") return;

    const resolved = themeMode === "auto" ? getSystemTheme() : themeMode;

    // Remove existing theme classes
    document.documentElement.classList.remove("theme-dark", "theme-light");

    // Add new theme class
    document.documentElement.classList.add(`theme-${resolved}`);

    // Set data attribute for CSS targeting
    document.documentElement.setAttribute("data-theme", resolved);
  };

  // Watch for theme changes
  watch(theme, (newTheme) => {
    applyTheme(newTheme);
  });

  // Listen for system theme changes when in auto mode
  onMounted(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = () => {
      if (theme.value === "auto") {
        applyTheme("auto");
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    }

    // Cleanup on unmount
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      }
    };
  });

  // Apply initial theme
  onMounted(() => {
    applyTheme(theme.value);
  });

  return {
    theme,
    resolvedTheme,
    isDark,
    isLight,
    setTheme,
    toggleTheme,
  };
}

/**
 * Get theme-aware CSS variable value
 *
 * @example
 * ```ts
 * const bgColor = getThemeVariable("--bg-primary");
 * ```
 */
export function getThemeVariable(variableName: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
}

/**
 * Set theme-aware CSS variable
 *
 * @example
 * ```ts
 * setThemeVariable("--accent-primary", "#ff6b6b");
 * ```
 */
export function setThemeVariable(variableName: string, value: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(variableName, value);
}

/**
 * Create theme-aware reactive style object
 *
 * @example
 * ```ts
 * const cardStyle = useThemeStyle({
 *   background: "--bg-card",
 *   borderColor: "--border-color",
 * });
 * ```
 */
export function useThemeStyle(variables: Record<string, string>) {
  const styles = ref<Record<string, string>>({});

  const updateStyles = () => {
    for (const [key, varName] of Object.entries(variables)) {
      styles.value[key] = getThemeVariable(varName);
    }
  };

  // Initial update
  if (typeof document !== "undefined") {
    updateStyles();
  }

  // Watch for theme changes
  if (typeof document !== "undefined") {
    const observer = new MutationObserver(() => {
      updateStyles();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Cleanup
    return () => observer.disconnect();
  }

  return styles;
}
