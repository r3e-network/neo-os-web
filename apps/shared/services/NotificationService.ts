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
   * Wrap an async operation with automatic error notification.
   *
   * On success, optionally shows a success toast (if `successKey` is provided).
   * On failure, shows an error toast and returns `undefined` instead of throwing.
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
    try {
      const result = await fn();
      if (successKey) this.success(successKey);
      return result;
    } catch (e) {
      this.error(e, errorKey);
      return undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private emit(message: string, type: NotificationType): void {
    this.eventBus.emit(NOTIFICATION_EVENT, { message, type } as Notification);
  }
}
