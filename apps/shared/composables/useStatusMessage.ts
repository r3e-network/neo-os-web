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
 * // status.value === { msg: "Vault created!", type: "success" }
 * // Auto-clears after DEFAULT_TIMEOUT_MS
 * ```
 */

import { ref, type Ref } from "vue";

export type StatusType = "success" | "error" | "warning" | "info" | "danger" | "loading";

export interface StatusMessage {
  msg: string;
  type: StatusType;
}

const DEFAULT_TIMEOUT_MS = 4000;

export function useStatusMessage(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const status: Ref<StatusMessage | null> = ref(null);

  const setStatus = (msg: string, type: StatusType) => {
    status.value = { msg, type };
    setTimeout(() => {
      if (status.value?.msg === msg) status.value = null;
    }, timeoutMs);
  };

  const clearStatus = () => {
    status.value = null;
  };

  return { status, setStatus, clearStatus };
}
