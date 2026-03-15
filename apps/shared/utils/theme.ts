import { readQueryParam } from "./url";

export type Theme = "light" | "dark";

function normalizeTheme(value?: string | null): Theme | null {
  if (!value) return null;
  const trimmed = value.toLowerCase();
  if (trimmed === "light") return "light";
  if (trimmed === "dark") return "dark";
  return null;
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
    const stored = normalizeTheme(window.localStorage?.getItem("theme"));
    if (stored) return stored;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  }
  return "dark";
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.classList.toggle("theme-light", theme === "light");
  if (typeof window !== "undefined") {
    window.localStorage?.setItem("theme", theme);
  }
}

export function initTheme(): Theme {
  const theme = getTheme();
  setTheme(theme);
  return theme;
}

export function listenForThemeChanges(): () => void {
  if (typeof window === "undefined") return () => {};

  // Get expected origin from parent (for iframe context) or self
  const expectedOrigin = (() => {
    try {
      if (window.parent !== window && document.referrer) {
        return new URL(document.referrer).origin;
      }
    } catch {
      // Ignore cross-origin errors
    }
    return window.location.origin;
  })();

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
