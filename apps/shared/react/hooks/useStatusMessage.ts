/**
 * useStatusMessage — React hook for status messages with auto-dismiss
 *
 * React equivalent of the observable composable in
 * composables/useStatusMessage.ts. Both wrappers consume the shared timing
 * and sticky-status policy in composables/statusMessageCore.ts so behavior
 * cannot drift between them.
 *
 * @example
 * ```tsx
 * const { status, setStatus, clearStatus } = useStatusMessage();
 * setStatus("Vault created!", "success");
 * // status === { msg: "Vault created!", type: "success" }
 * // Auto-clears after DEFAULT_TIMEOUT_MS (success/info/warning/loading only)
 *
 * setStatus("Transaction failed", "error");
 * // status === { msg: "Transaction failed", type: "error" }
 * // Persists until replaced or clearStatus() — never auto-cleared
 * ```
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DEFAULT_TIMEOUT_MS,
  createStatusTimer,
} from "../../composables/statusMessageCore";
import type {
  StatusMessage,
  StatusType,
} from "../../composables/statusMessageCore";

export { DEFAULT_TIMEOUT_MS, isStickyStatus } from "../../composables/statusMessageCore";
export type { StatusMessage, StatusType } from "../../composables/statusMessageCore";

export function useStatusMessage(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [status, setStatusState] = useState<StatusMessage | null>(null);
  const statusRef = useRef<StatusMessage | null>(null);
  const timeoutMsRef = useRef(timeoutMs);

  // Keep refs in sync for the timer callback closures
  statusRef.current = status;
  timeoutMsRef.current = timeoutMs;

  // Shared timer is created once; closures read/clear via refs so the policy
  // stays identical to the observable composable while always using the
  // latest timeout value.
  const timerRef = useRef<ReturnType<typeof createStatusTimer> | null>(null);
  if (timerRef.current === null) {
    timerRef.current = createStatusTimer(
      () => statusRef.current?.msg ?? null,
      () => {
        setStatusState(null);
        statusRef.current = null;
      },
      () => timeoutMsRef.current,
    );
  }

  // Cleanup timer on unmount
  useEffect(() => {
    const timer = timerRef.current;
    return () => {
      timer?.cancel();
    };
  }, []);

  const setStatus = useCallback((msg: string, type: StatusType) => {
    const newStatus: StatusMessage = { msg, type };
    setStatusState(newStatus);
    statusRef.current = newStatus;
    timerRef.current?.schedule(msg, type);
  }, []);

  const clearStatus = useCallback(() => {
    timerRef.current?.cancel();
    setStatusState(null);
    statusRef.current = null;
  }, []);

  return { status, setStatus, clearStatus };
}
