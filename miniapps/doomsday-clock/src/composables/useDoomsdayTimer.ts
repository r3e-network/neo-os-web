import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseGas } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { normalizeScriptHash, addressToScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";

export interface TimerState {
  endTime: number;
  now: number;
  isActive: boolean;
}

export function useDoomsdayTimer() {
  const { t } = createUseI18n(messages)();

  const endTime = ref(0);
  const now = ref(Date.now());
  const isRoundActive = ref(false);
  const MAX_DURATION_SECONDS = 86400;

  const timeRemainingSeconds = computed(() => {
    if (!endTime.value) return 0;
    return Math.max(0, Math.floor((endTime.value - now.value) / 1000));
  });

  const countdown = computed(() => {
    const total = timeRemainingSeconds.value;
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  });

  const dangerLevel = computed(() => {
    const seconds = timeRemainingSeconds.value;
    if (seconds > 7200) return "low";
    if (seconds > 3600) return "medium";
    if (seconds > 600) return "high";
    return "critical";
  });

  const dangerLevelText = computed(() => {
    switch (dangerLevel.value) {
      case "low": return t("dangerLow");
      case "medium": return t("dangerMedium");
      case "high": return t("dangerHigh");
      case "critical": return t("dangerCritical");
      default: return t("dangerLow");
    }
  });

  const dangerProgress = computed(() => {
    if (!timeRemainingSeconds.value) return 0;
    return Math.min(100, (timeRemainingSeconds.value / MAX_DURATION_SECONDS) * 100);
  });

  const shouldPulse = computed(() => timeRemainingSeconds.value <= 600);

  const updateNow = () => {
    now.value = Date.now();
  };

  const setEndTime = (timestamp: number) => {
    endTime.value = timestamp;
  };

  return {
    endTime,
    now,
    isRoundActive,
    timeRemainingSeconds,
    countdown,
    dangerLevel,
    dangerLevelText,
    dangerProgress,
    shouldPulse,
    updateNow,
    setEndTime,
    MAX_DURATION_SECONDS,
  };
}
