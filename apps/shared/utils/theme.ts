import { readQueryParam } from "./url";
import { getHostOrigin } from "./runtime-origin";

export type Theme = "light" | "dark";

function normalizeTheme(value?: string | null): Theme | null {
  if (!value) return null;
  const trimmed = value.toLowerCase();
  if (trimmed === "light") return "light";
  if (trimmed === "dark") return "dark";
  return null;
}

// Sandboxed iframes (sandbox="allow-scripts" without allow-same-origin)
// throw when accessing window.localStorage. Optional chaining doesn't help
// because the property exists but the getter throws — wrap in try/catch.
function safeReadStorage(key: string): string | null {
  try {
    return typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // sandboxed iframe — ignore
  }
}

export function getTheme(): Theme {
  const fromQuery = normalizeTheme(readQueryParam("theme"));
  if (fromQuery) return fromQuery;
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    const fromAttr = normalizeTheme(attr);
    if (fromAttr) return fromAttr;
  }
  if (typeof window !== "undefined") {
    const stored = normalizeTheme(safeReadStorage("theme"));
    if (stored) return stored;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
  }
  // Platform default is light (Polymarket-aligned). Opt into dark via
  // ?theme=dark, data-theme="dark", or system preference.
  return "light";
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.classList.toggle("theme-light", theme === "light");
  safeWriteStorage("theme", theme);
}

export function initTheme(): Theme {
  const theme = getTheme();
  setTheme(theme);
  return theme;
}

export function listenForThemeChanges(): () => void {
  if (typeof window === "undefined") return () => {};

  const expectedOrigin = getHostOrigin();

  const handler = (event: MessageEvent) => {
    const isParentMessage = event.source === window.parent;
    const isAllowedOrigin =
      event.origin === expectedOrigin ||
      event.origin === window.location.origin ||
      (isParentMessage &&
        (event.origin === "null" || expectedOrigin === "null"));

    if (!isAllowedOrigin) {
      return;
    }

    const data = event?.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "theme-change") return;
    const next = normalizeTheme((data as { theme?: string }).theme);
    if (!next) return;
    setTheme(next);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
