/**
 * Theme system with dark mode support
 * Wraps next-themes for production-grade theme management
 */

export { useTheme, ThemeProvider } from "next-themes";

export type Theme = "light" | "dark" | "system";

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  localStorage.setItem("theme", theme);
}

export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) || "system";
}
