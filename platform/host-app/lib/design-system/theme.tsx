/**
 * Theme System - Dark/Light Mode and Theme Management
 * Provides theme configuration, switching, and context
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { colors } from "./tokens";

// ============================================================================
// Theme Types
// ============================================================================

export type ThemeMode = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
}

// ============================================================================
// Theme Color Configurations
// ============================================================================

const darkThemeColors: ThemeColors = {
  background: "#020617",
  foreground: "#F8FAFC",
  card: "rgba(15, 23, 42, 0.8)",
  cardForeground: "#F8FAFC",
  primary: "#00E599",
  primaryForeground: "#020617",
  secondary: "#7000FF",
  secondaryForeground: "#F8FAFC",
  muted: "#1F2937",
  mutedForeground: "#9CA3AF",
  accent: "#374151",
  accentForeground: "#F8FAFC",
  destructive: "#EF4444",
  destructiveForeground: "#F8FAFC",
  border: "#334155",
  input: "#334155",
  ring: "#00E599",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

const lightThemeColors: ThemeColors = {
  background: "#F8FAFC",
  foreground: "#1F2937",
  card: "rgba(255, 255, 255, 1)",
  cardForeground: "#1F2937",
  primary: "#00E599",
  primaryForeground: "#020617",
  secondary: "#7000FF",
  secondaryForeground: "#F8FAFC",
  muted: "#F3F4F6",
  mutedForeground: "#6B7280",
  accent: "#E5E7EB",
  accentForeground: "#1F2937",
  destructive: "#EF4444",
  destructiveForeground: "#F8FAFC",
  border: "#E5E7EB",
  input: "#D1D5DB",
  ring: "#00E599",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

// ============================================================================
// Theme Storage Keys
// ============================================================================

const THEME_STORAGE_KEY = "neo-miniapps-theme";
const COLOR_SCHEME_KEY = "neo-miniapps-color-scheme";

// ============================================================================
// Theme Context
// ============================================================================

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  colorScheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================================================
// Theme Provider Component
// ============================================================================

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  enableSystemDetection?: boolean;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeProvider({
  children,
  defaultMode = "system",
  enableSystemDetection = true,
  onThemeChange,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored as ThemeMode) || defaultMode;
  });

  const [systemPreference, setSystemPreference] = useState<ColorScheme>(() => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  // Calculate color scheme based on mode
  const colorScheme = useMemo<ColorScheme>(() => {
    if (mode === "system") {
      return systemPreference;
    }
    return mode;
  }, [mode, systemPreference]);

  const isDark = colorScheme === "dark";

  const theme = useMemo<Theme>(
    () => ({
      mode,
      colors: isDark ? darkThemeColors : lightThemeColors,
      isDark,
    }),
    [mode, isDark],
  );

  // Handle system preference changes
  useEffect(() => {
    if (!enableSystemDetection) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [enableSystemDetection]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Set color scheme for CSS
    root.style.setProperty("color-scheme", colorScheme);

    // Set dark class on html element
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Set CSS variables
    const themeColors = isDark ? darkThemeColors : lightThemeColors;
    Object.entries(themeColors).forEach(([key, value]) => {
      root.style.setProperty(`--ds-${key}`, value);
    });

    // Callback
    onThemeChange?.(theme);
  }, [colorScheme, isDark, theme, onThemeChange]);

  // Set mode and persist
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    }
  }, []);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    if (mode === "dark") {
      setMode("light");
    } else if (mode === "light") {
      setMode("dark");
    } else {
      // If system, switch to opposite of current system preference
      setMode(systemPreference === "dark" ? "light" : "dark");
    }
  }, [mode, systemPreference, setMode]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      colorScheme,
      setMode,
      toggleTheme,
      isDark,
    }),
    [theme, mode, colorScheme, setMode, toggleTheme, isDark],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ============================================================================
// Hook to Use Theme
// ============================================================================

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// ============================================================================
// CSS Variables Generator
// ============================================================================

/**
 * Generate CSS variables as a string for inline styles
 */
export function getCSSVariables(
  isDark: boolean = false,
): Record<string, string> {
  const themeColors = isDark ? darkThemeColors : lightThemeColors;
  const result: Record<string, string> = {};

  Object.entries(themeColors).forEach(([key, value]) => {
    result[`--ds-${key}`] = value;
  });

  return result;
}

/**
 * Generate all design tokens as CSS custom properties
 */
export function generateAllCSSVariables(isDark: boolean = false): string {
  const themeColors = isDark ? darkThemeColors : lightThemeColors;
  const tokens = colors as Record<string, Record<string, string>>;

  let css = ":root {\n";

  // Theme colors
  Object.entries(themeColors).forEach(([key, value]) => {
    css += ` --ds-${key}: ${value};\n`;
  });

  css += "\n";

  // Color tokens
  Object.entries(tokens).forEach(([category, shades]) => {
    Object.entries(shades).forEach(([shade, value]) => {
      css += ` --ds-${category}-${shade}: ${value};\n`;
    });
  });

  css += "}\n";

  return css;
}

// ============================================================================
// Export Theme Colors for Direct Usage
// ============================================================================

export { darkThemeColors, lightThemeColors };
