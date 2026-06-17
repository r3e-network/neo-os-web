/**
 * Status Message Core
 *
 * Single source of truth for status-message behavior shared by both the
 * observable composable (`composables/useStatusMessage.ts`) and the React
 * hook (`react/hooks/useStatusMessage.ts`). Centralizing the `StatusType`,
 * timeout policy, and timer/clear logic here ensures the two thin wrappers
 * cannot drift apart.
 *
 * Behavior:
 * - `error` / `danger` statuses are STICKY: the user must read and act on
 *   them, so they persist until replaced by another status or dismissed
 *   manually. They are never auto-cleared by a timer.
 * - `success` / `info` / `warning` / `loading` statuses auto-clear after a
 *   short timeout so transient confirmations do not linger.
 */

export type StatusType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "danger"
  | "loading";

export interface StatusMessage {
  msg: string;
  type: StatusType;
}

/** Auto-dismiss timeout for transient (success/info/warning/loading) statuses. */
export const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Status types the user must read and act on. These are never auto-cleared;
 * they remain visible until a new status replaces them or the caller clears
 * the status explicitly.
 */
const STICKY_TYPES: ReadonlySet<StatusType> = new Set<StatusType>([
  "error",
  "danger",
]);

/**
 * Whether a status of the given type should persist until manually replaced
 * or dismissed (true) versus auto-clearing after the timeout (false).
 */
export function isStickyStatus(type: StatusType): boolean {
  return STICKY_TYPES.has(type);
}

/**
 * Manages a single auto-dismiss timer with the shared sticky-status policy.
 *
 * The manager is intentionally framework-agnostic: callers supply how the
 * current status is read and how it is cleared, so both an observable and a
 * React state setter can reuse the identical timing/sticky logic.
 *
 * @param getCurrentMessage Returns the message string currently displayed, or
 *   `null`/`undefined` if nothing is displayed. Used to avoid clearing a
 *   status that has since been replaced by a newer one.
 * @param clear Clears the displayed status (sets it to `null`).
 * @param timeoutMs Auto-dismiss timeout for transient statuses. May be a
 *   number or a getter, so callers whose timeout can change over time (e.g. a
 *   React hook reading the latest prop) always use the current value.
 */
export function createStatusTimer(
  getCurrentMessage: () => string | null | undefined,
  clear: () => void,
  timeoutMs: number | (() => number) = DEFAULT_TIMEOUT_MS,
) {
  let currentTimer: ReturnType<typeof setTimeout> | undefined;

  const resolveTimeout = (): number =>
    typeof timeoutMs === "function" ? timeoutMs() : timeoutMs;

  const cancel = () => {
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
      currentTimer = undefined;
    }
  };

  /**
   * Schedule auto-dismiss for a newly set status. Sticky statuses
   * (error/danger) are left in place with no timer.
   */
  const schedule = (msg: string, type: StatusType) => {
    cancel();
    if (isStickyStatus(type)) return;
    currentTimer = setTimeout(() => {
      // Only clear if the message hasn't been replaced in the meantime.
      if (getCurrentMessage() === msg) clear();
      currentTimer = undefined;
    }, resolveTimeout());
  };

  return { schedule, cancel };
}
