/**
 * Resolve the trusted host origin for host-native MiniApp runtimes.
 *
 * In the unified web app this is normally `window.location.origin`. A legacy
 * embedded preview may still provide its host through `document.referrer`.
 */
export function getHostOrigin(): string {
  if (typeof window === "undefined") return "";
  try {
    if (window.parent !== window && typeof document !== "undefined" && document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch {
    // Ignore malformed referrers and fall back to the current origin.
  }
  return window.location.origin;
}
