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

import { ref, type Ref, onUnmounted } from "vue";

export type StatusType = "success" | "error" | "warning" | "info" | "danger" | "loading";

export interface StatusMessage {
  msg: string;
  type: StatusType;
}

const DEFAULT_TIMEOUT_MS = 4000;

export function useStatusMessage(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const status: Ref<StatusMessage | null> = ref(null);
  let currentTimer: ReturnType<typeof setTimeout> | undefined;

  const setStatus = (msg: string, type: StatusType) => {
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
      currentTimer = undefined;
    }
    status.value = { msg, type };
    currentTimer = setTimeout(() => {
      if (status.value?.msg === msg) status.value = null;
      currentTimer = undefined;
    }, timeoutMs);
  };

  const clearStatus = () => {
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
      currentTimer = undefined;
    }
    status.value = null;
  };

  onUnmounted(() => {
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
      currentTimer = undefined;
    }
  });

  return { status, setStatus, clearStatus };
}
