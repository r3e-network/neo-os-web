// =============================================================================
// MiniApp Preview URL Helpers
// =============================================================================

export function resolveEntryUrl(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_HOST_APP_URL?.trim().replace(/\/$/, "");
    if (base) return `${base}${trimmed}`;
    if (typeof window !== "undefined") return `${window.location.origin}${trimmed}`;
    return trimmed;
  }
  return trimmed;
}

export function buildPreviewUrl(url: string, locale: string, theme: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed || trimmed.startsWith("mf://")) return "";
  const resolved = resolveEntryUrl(trimmed);
  if (!resolved) return "";
  const separator = resolved.includes("?") ? "&" : "?";
  return `${resolved}${separator}lang=${locale}&theme=${theme}&embedded=1&layout=web`;
}
