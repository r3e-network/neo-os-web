/**
 * NotificationService - Centralized notification and error handling for miniapps.
 *
 * Eliminates the duplicated try/catch + setStatus pattern found across 36+ miniapps:
 *
 * ```ts
 * // BEFORE (repeated in every action handler):
 * try {
 *   await doSomething();
 *   ctx.setStatus(ctx.t("success"), "success");
 * } catch (e) {
 *   ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
 * }
 *
 * // AFTER (one-liner via guard):
 * await notify.guard(() => doSomething(), "success");
 * ```
 *
 * The service emits events on the EventBus so that any UI layer (toasts,
 * status bars, MiniAppRoot) can subscribe and render notifications.
 *
 * @example
 * ```ts
 * const notify = new NotificationService(eventBus, ctx.t);
 * notify.success("stakeSuccess");
 * notify.error(caughtError);
 * await notify.guard(() => anchor.stake(amount), "stakeSuccess");
 * ```
 */

import type { EventBus } from "./EventBus";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NotificationType = "success" | "error" | "warning" | "info";

export interface Notification {
  /** Human-readable message (already translated) */
  message: string;
  /** Severity / visual style */
  type: NotificationType;
  /** Auto-dismiss duration in ms. 0 = sticky (user must dismiss). Default varies by type. */
  duration?: number;
}

/** Well-known event name used on the EventBus */
export const NOTIFICATION_EVENT = "platform:notification";

/**
 * Discriminated result returned by {@link NotificationService.guardResult}.
 *
 * The `ok` flag lets callers gate post-success steps (form resets, modal
 * closes, counters) explicitly instead of inferring success from the
 * truthiness of the wrapped value — which breaks for void/falsy results.
 */
export type GuardResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

// ---------------------------------------------------------------------------
// Chain error mapping
// ---------------------------------------------------------------------------

/**
 * i18n keys (all defined in `@shared/locale/base-messages`) that the known
 * chain/RPC failure families map to.
 */
export type ChainErrorKey =
  | "userRejected"
  | "contractUnavailable"
  | "insufficientGas"
  | "networkTimeout"
  | "transactionFailed";

/**
 * Known failure families, most specific first. A family only needs to match
 * the raw text once — order matters because a VM FAULT message often embeds a
 * more specific assert (e.g. `FAULT: insufficient prepaid gas` must classify
 * as `insufficientGas`, not the generic `transactionFailed`).
 */
const CHAIN_ERROR_FAMILIES: ReadonlyArray<{
  key: ChainErrorKey;
  patterns: readonly RegExp[];
}> = [
  {
    key: "userRejected",
    patterns: [
      /user\s+(rejected|denied|cancel\w*)/i,
      /(rejected|denied|cancel(?:l?ed))\s+by\s+(the\s+)?user/i,
      /\bUSER_REJECT(?:ED)?\b/,
    ],
  },
  {
    key: "contractUnavailable",
    patterns: [
      /contract\s+(?:is\s+)?not\s+(?:configured|deployed|available)/i,
      /no\s+contract\s+(?:hash|address)/i,
      /contract\s+(?:hash|address)\s+(?:is\s+)?(?:not\s+configured|missing)/i,
    ],
  },
  {
    key: "insufficientGas",
    patterns: [
      /insufficient\s+(?:prepaid\s+)?gas/i,
      /insufficient\s+(?:funds|network\s+fee)/i,
      /not\s+enough\s+gas/i,
    ],
  },
  {
    key: "networkTimeout",
    patterns: [
      /\btimed?\s*out\b/i,
      /\btimeout\b/i,
      /failed\s+to\s+fetch/i,
      /fetch\s+failed/i,
      /network\s*error/i,
      /\bECONN(?:REFUSED|RESET)\b|\bETIMEDOUT\b|\bENOTFOUND\b/,
      /aborted\s+due\s+to\s+timeout/i,
    ],
  },
  {
    key: "transactionFailed",
    patterns: [
      /\bFAULT\b/,
      /System\.Contract\.Call/i,
      /vm\s+exited/i,
      /smart\s+contract\s+execution/i,
    ],
  },
];

function rawErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/**
 * Classify an error into a known chain/RPC failure family.
 *
 * Returns the matching i18n key, or `null` when the error does not belong to
 * a known family — callers should then keep their existing handling (the raw
 * message may already be a localized, app-authored string).
 */
export function classifyChainError(error: unknown): ChainErrorKey | null {
  if (error instanceof Error && error.name === "TimeoutError") {
    return "networkTimeout";
  }
  const raw = rawErrorText(error);
  if (!raw) return null;
  for (const family of CHAIN_ERROR_FAMILIES) {
    if (family.patterns.some((pattern) => pattern.test(raw))) {
      return family.key;
    }
  }
  return null;
}

/**
 * Map a chain/RPC error to a localized, user-readable message.
 *
 * Pattern-matches the known failure families (user rejected, contract not
 * configured, insufficient GAS / prepaid gas, RPC timeout / network failure,
 * VM FAULT) against the raw error text and translates the family's i18n key.
 * Unrecognized errors return `null` so callers can fall back to their own
 * handling without losing meaningful app-level messages.
 *
 * @param error - The caught error (Error, string, or anything)
 * @param t     - i18n translate function (keys live in base-messages)
 * @returns Translated message for a known family, otherwise `null`
 */
export function mapChainError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  const key = classifyChainError(error);
  return key ? t(key) : null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class NotificationService {
  constructor(
    private eventBus: EventBus,
    private t: (key: string, params?: Record<string, string | number>) => string,
  ) {}

  /** Show a success notification. `messageKey` is passed through the i18n `t` function. */
  success(messageKey: string, params?: Record<string, string | number>): void {
    this.emit(this.t(messageKey, params), "success");
  }

  /**
   * Show an error notification.
   *
   * Known chain/RPC failure families (see {@link mapChainError}) are
   * translated to user-readable copy and the raw text goes to
   * `console.debug` — wallet/VM/RPC strings never reach the toast verbatim.
   * Anything else keeps the legacy contract: Error objects use `.message`,
   * plain strings are used as-is (both may already be app-localized copy),
   * and other values fall back to translating `fallbackKey`.
   */
  error(error: unknown, fallbackKey = "error"): void {
    const mapped = mapChainError(error, this.t);
    if (mapped !== null) {
      const raw = error instanceof Error ? error.message : String(error);
      console.debug(`[notify] chain error mapped to localized copy: ${raw}`);
      this.emit(mapped, "error");
      return;
    }
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : this.t(fallbackKey);
    this.emit(msg, "error");
  }

  /** Show a warning notification. */
  warn(messageKey: string, params?: Record<string, string | number>): void {
    this.emit(this.t(messageKey, params), "warning");
  }

  /** Show an informational notification. */
  info(messageKey: string, params?: Record<string, string | number>): void {
    this.emit(this.t(messageKey, params), "info");
  }

  /**
   * Wrap an async operation with automatic error notification, returning an
   * explicit `{ok}` discriminator.
   *
   * On success, optionally shows a success toast (if `successKey` is provided)
   * and returns `{ ok: true, value }`. On failure, shows an error toast and
   * returns `{ ok: false, error }` instead of throwing — so callers can gate
   * post-success steps on `result.ok` without re-implementing try/catch.
   *
   * @param fn         - The async operation to execute
   * @param successKey - Optional i18n key for the success message
   * @param errorKey   - Optional i18n key used as fallback when the error is not an Error instance
   * @returns `{ ok: true, value }` on success, `{ ok: false, error }` on failure
   */
  async guardResult<T>(
    fn: () => Promise<T>,
    successKey?: string,
    errorKey?: string,
  ): Promise<GuardResult<T>> {
    try {
      const value = await fn();
      if (successKey) this.success(successKey);
      return { ok: true, value };
    } catch (e) {
      this.error(e, errorKey);
      return { ok: false, error: e };
    }
  }

  /**
   * Wrap an async operation with automatic error notification.
   *
   * On success, optionally shows a success toast (if `successKey` is provided).
   * On failure, shows an error toast and returns `undefined` instead of throwing.
   *
   * Existing callers gate on the truthiness of the returned value (e.g.
   * gasbox's `pulled === true`), so this legacy contract is frozen — prefer
   * {@link guardResult} when the caller needs to tell "fn resolved with a
   * falsy/void value" apart from "fn threw".
   *
   * @param fn         - The async operation to execute
   * @param successKey - Optional i18n key for the success message
   * @param errorKey   - Optional i18n key used as fallback when the error is not an Error instance
   * @returns The result of `fn`, or `undefined` if it threw
   */
  async guard<T>(
    fn: () => Promise<T>,
    successKey?: string,
    errorKey?: string,
  ): Promise<T | undefined> {
    const result = await this.guardResult(fn, successKey, errorKey);
    return result.ok ? result.value : undefined;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private emit(message: string, type: NotificationType): void {
    this.eventBus.emit(NOTIFICATION_EVENT, { message, type } as Notification);
  }
}
