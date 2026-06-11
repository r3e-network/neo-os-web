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
   * Accepts Error objects (uses `.message`), plain strings (used as-is),
   * or anything else (falls back to translating `fallbackKey`).
   */
  error(error: unknown, fallbackKey = "error"): void {
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
