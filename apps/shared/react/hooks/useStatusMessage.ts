/**
 * useStatusMessage — React hook for status messages with auto-dismiss
 *
 * React equivalent of the Vue composable in composables/useStatusMessage.ts.
 * Provides a status message state with automatic timeout clearing.
 *
 * @example
 * ```tsx
 * const { status, setStatus, clearStatus } = useStatusMessage();
 * setStatus("Vault created!", "success");
 * // status === { msg: "Vault created!", type: "success" }
 * // Auto-clears after DEFAULT_TIMEOUT_MS
 * ```
 */

import { useState, useCallback, useRef, useEffect } from "react";

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

const DEFAULT_TIMEOUT_MS = 4000;

export function useStatusMessage(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [status, setStatusState] = useState<StatusMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const statusRef = useRef<StatusMessage | null>(null);

  // Keep ref in sync for timer callback closure
  statusRef.current = status;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const setStatus = useCallback(
    (msg: string, type: StatusType) => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      const newStatus: StatusMessage = { msg, type };
      setStatusState(newStatus);
      statusRef.current = newStatus;
      timerRef.current = setTimeout(() => {
        // Only clear if the message hasn't changed
        if (statusRef.current?.msg === msg) {
          setStatusState(null);
          statusRef.current = null;
        }
        timerRef.current = undefined;
      }, timeoutMs);
    },
    [timeoutMs],
  );

  const clearStatus = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    setStatusState(null);
    statusRef.current = null;
  }, []);

  return { status, setStatus, clearStatus };
}
