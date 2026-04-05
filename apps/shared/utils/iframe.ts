/**
 * Detect the parent frame's origin when running inside an iframe.
 *
 * Returns the parent's origin (from document.referrer) when the window has a
 * parent that is *not* itself, otherwise falls back to `window.location.origin`.
 */
export function getParentOrigin(): string {
  try {
    if (window.parent !== window && document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch {
    // ignore parsing errors
  }
  return window.location.origin;
}
