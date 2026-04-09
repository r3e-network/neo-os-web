/**
 * Status Message Composable
 *
 * Provides a standardized status message pattern with auto-dismiss.
 * Replaces the duplicated `setStatus` helper found across miniapps.
 *
 * @example
 * ```ts
 * const { status, setStatus } = useStatusMessage();
 * setStatus("Vault created!", "success");
 * // status.get() === { msg: "Vault created!", type: "success" }
 * // Auto-clears after DEFAULT_TIMEOUT_MS
 * ```
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";

export type StatusType = "success" | "error" | "warning" | "info" | "danger" | "loading";

export interface StatusMessage {
  msg: string;
  type: StatusType;
}

const DEFAULT_TIMEOUT_MS = 4000;

export function useStatusMessage(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const status: Observable<StatusMessage | null> = createObservable<StatusMessage | null>(null);
  let currentTimer: ReturnType<typeof setTimeout> | undefined;

  const setStatus = (msg: string, type: StatusType) => {
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
      currentTimer = undefined;
    }
    status.set({ msg, type });
    currentTimer = setTimeout(() => {
      if (status.get()?.msg === msg) status.set(null);
      currentTimer = undefined;
    }, timeoutMs);
  };

  const clearStatus = () => {
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
      currentTimer = undefined;
    }
    status.set(null);
  };

  /** Cleanup function — caller is responsible for invoking on teardown. */
  const dispose = () => {
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
      currentTimer = undefined;
    }
  };

  return { status, setStatus, clearStatus, dispose };
}
