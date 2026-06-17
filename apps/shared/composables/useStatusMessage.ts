/**
 * Status Message Composable
 *
 * Provides a standardized status message pattern with auto-dismiss.
 * Replaces the duplicated `setStatus` helper found across miniapps.
 *
 * Timing and sticky-status policy live in `statusMessageCore.ts`, shared with
 * the React hook in `react/hooks/useStatusMessage.ts` so behavior cannot drift.
 *
 * @example
 * ```ts
 * const { status, setStatus } = useStatusMessage();
 * setStatus("Vault created!", "success");
 * // status.get() === { msg: "Vault created!", type: "success" }
 * // Auto-clears after DEFAULT_TIMEOUT_MS (success/info/warning/loading only)
 *
 * setStatus("Transaction failed", "error");
 * // status.get() === { msg: "Transaction failed", type: "error" }
 * // Persists until replaced or clearStatus() — never auto-cleared
 * ```
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import {
  DEFAULT_TIMEOUT_MS,
  createStatusTimer,
} from "./statusMessageCore";
import type { StatusMessage, StatusType } from "./statusMessageCore";

export { DEFAULT_TIMEOUT_MS, isStickyStatus } from "./statusMessageCore";
export type { StatusMessage, StatusType } from "./statusMessageCore";

export function useStatusMessage(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const status: Observable<StatusMessage | null> = createObservable<StatusMessage | null>(null);

  const timer = createStatusTimer(
    () => status.get()?.msg ?? null,
    () => status.set(null),
    timeoutMs,
  );

  const setStatus = (msg: string, type: StatusType) => {
    status.set({ msg, type });
    timer.schedule(msg, type);
  };

  const clearStatus = () => {
    timer.cancel();
    status.set(null);
  };

  /** Cleanup function — caller is responsible for invoking on teardown. */
  const dispose = () => {
    timer.cancel();
  };

  return { status, setStatus, clearStatus, dispose };
}
