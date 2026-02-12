import { ref } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";
import { useErrorHandler } from "@shared/composables/useErrorHandler";

const APP_ID = "miniapp-flashloan";

export function useFlashloanRepayment() {
  const { t } = useI18n();
  const { handleError, getUserMessage } = useErrorHandler();
  const { invokeContract } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();

  const repaymentStatus = ref<{ msg: string; type: "success" | "error" } | null>(null);
  const isProcessingRepayment = ref(false);

  const checkRepaymentStatus = async (loanId: string) => {
    try {
      const res = await listEvents({ app_id: APP_ID, event_name: "LoanRepaid", limit: 25 });
      const match = res.events.find((evt: Record<string, unknown>) => {
        const state = evt?.state;
        if (Array.isArray(state) && state.length > 0) {
          return String(state[0]) === loanId;
        }
        return false;
      });
      return match !== undefined;
    } catch (e: unknown) {
      handleError(e, { operation: "checkRepaymentStatus", metadata: { loanId } });
      return false;
    }
  };

  return {
    repaymentStatus,
    isProcessingRepayment,
    checkRepaymentStatus,
  };
}
