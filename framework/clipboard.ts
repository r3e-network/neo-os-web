/**
 * framework/clipboard — app.clipboard + app.share surfaces (extraction plan §2/S9).
 *
 * Standalone factories consumed by `createMiniAppFramework`:
 *
 * - `createClipboardSurface` — copy text / the connected wallet address with
 *   successKey toasts routed through an injected notify fn. Falls back from
 *   `navigator.clipboard.writeText` to the legacy textarea + execCommand lane
 *   (ClipboardService parity) and degrades to a reported failure when the
 *   host has no clipboard at all.
 * - `createShareSurface` — `share.url(value)` prefers the Web Share API and
 *   falls back to a clipboard copy ("report it as a copy"); a user-cancelled
 *   native share rejects with an AbortError and is silenced
 *   (recovery-guardian semantics).
 *
 * Toast keys default to the shared base-messages catalogue ("copied" /
 * "copyFailed") so migrated apps keep byte-identical toast strings.
 */

/** Minimal structural slice of the platform notify service (or app.notify). */
export interface FrameworkNotifyLike {
  success?(messageKey: string, params?: Record<string, string | number>): void;
  error?(error: unknown, fallbackKey?: string): void;
}

export interface FrameworkClipboardCopyOptions {
  /** Toast key on successful copy. Defaults to "copied" (shared base message). */
  successKey?: string;
  /** Toast key when the copy fails. Defaults to "copyFailed" (shared base message). */
  errorKey?: string;
}

export interface ClipboardSurfaceDeps {
  /** Injected notify fn (`ctx.services.notify` / app.notify); absent → silent. */
  notify?: FrameworkNotifyLike;
  /**
   * Connected wallet-address accessor backing `copyAddress()` (typically
   * `() => chain.address.get()`); absent or empty → copyAddress is a no-op.
   */
  address?: () => string | null | undefined;
  /** Clipboard write override (test seam / non-browser hosts). */
  writeText?: (text: string) => void | Promise<void>;
}

export interface FrameworkClipboardSurface {
  /** Copy text to the clipboard; resolves true on success, false on failure. */
  copy(text: string, options?: FrameworkClipboardCopyOptions): Promise<boolean>;
  /**
   * Copy the connected wallet address. Resolves false without toasting when
   * no wallet is connected (nothing to copy is not an error).
   */
  copyAddress(successKey?: string): Promise<boolean>;
}

export type FrameworkShareOutcome = "shared" | "copied" | "dismissed" | "failed";

export interface FrameworkShareUrlOptions {
  /** Toast key when the clipboard fallback copied the value. Defaults to "copied". */
  copiedKey?: string;
  /** Toast key after a successful native share; omitted → no toast (the share sheet is its own feedback). */
  sharedKey?: string;
  /** Error toast fallback key. Defaults to "copyFailed". */
  errorKey?: string;
}

export interface ShareSurfaceDeps extends ClipboardSurfaceDeps {
  /**
   * Native share override. `undefined` → autodetect `navigator.share`;
   * `null` → force the clipboard fallback (hosts without a share sheet).
   */
  share?: ((data: { url?: string; text?: string }) => Promise<void>) | null;
  /** Reuse an existing clipboard surface for the fallback lane. */
  clipboard?: FrameworkClipboardSurface;
}

export interface FrameworkShareSurface {
  /**
   * Share a URL (or plain text) via the native share sheet, falling back to
   * a clipboard copy when the host has no Web Share API.
   */
  url(value: string, options?: FrameworkShareUrlOptions): Promise<FrameworkShareOutcome>;
}

const DEFAULT_COPY_SUCCESS_KEY = "copied";
const DEFAULT_COPY_ERROR_KEY = "copyFailed";

async function defaultWriteText(text: string): Promise<void> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(text);
    return;
  }
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    throw new Error("Clipboard is not available in this host");
  }
  // Legacy fallback for older webviews (ClipboardService parity).
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Clipboard copy was rejected by the host");
}

/** A user-dismissed share sheet rejects with an AbortError — never a toast. */
function isShareAborted(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "AbortError")
  );
}

function looksLikeWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function createClipboardSurface(deps: ClipboardSurfaceDeps = {}): FrameworkClipboardSurface {
  const writeText = deps.writeText ?? defaultWriteText;

  const surface: FrameworkClipboardSurface = {
    async copy(text, options = {}) {
      try {
        await writeText(String(text ?? ""));
        deps.notify?.success?.(options.successKey ?? DEFAULT_COPY_SUCCESS_KEY);
        return true;
      } catch (error) {
        deps.notify?.error?.(error, options.errorKey ?? DEFAULT_COPY_ERROR_KEY);
        return false;
      }
    },

    async copyAddress(successKey) {
      const address = String(deps.address?.() ?? "").trim();
      if (!address) return false;
      return surface.copy(address, { successKey: successKey ?? DEFAULT_COPY_SUCCESS_KEY });
    },
  };

  return surface;
}

export function createShareSurface(deps: ShareSurfaceDeps = {}): FrameworkShareSurface {
  const clipboard = deps.clipboard ?? createClipboardSurface(deps);

  const resolveShare = (): ((data: { url?: string; text?: string }) => Promise<void>) | null => {
    if (deps.share !== undefined) return deps.share;
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (typeof nav?.share !== "function") return null;
    return (data) => nav.share(data);
  };

  return {
    async url(value, options = {}) {
      const text = String(value ?? "").trim();
      if (!text) return "failed";

      const share = resolveShare();
      if (share) {
        try {
          await share(looksLikeWebUrl(text) ? { url: text } : { text });
          if (options.sharedKey) deps.notify?.success?.(options.sharedKey);
          return "shared";
        } catch (error) {
          if (isShareAborted(error)) return "dismissed";
          deps.notify?.error?.(error, options.errorKey ?? DEFAULT_COPY_ERROR_KEY);
          return "failed";
        }
      }

      // No Web Share API: fall back to clipboard but report it as a copy.
      const copied = await clipboard.copy(text, {
        successKey: options.copiedKey ?? DEFAULT_COPY_SUCCESS_KEY,
        errorKey: options.errorKey,
      });
      return copied ? "copied" : "failed";
    },
  };
}
