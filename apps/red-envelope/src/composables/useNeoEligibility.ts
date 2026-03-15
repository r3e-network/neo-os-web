import { ref } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const APP_ID = "miniapp-redenvelope";

export interface UseNeoEligibilityReturn {
  isEligible: ReturnType<typeof ref<boolean>>;
  neoBalance: ReturnType<typeof ref<number>>;
  holdingDays: ReturnType<typeof ref<number>>;
  reason: ReturnType<typeof ref<string>>;
  checking: ReturnType<typeof ref<boolean>>;
  checkEligibility: (contractHash: string, envelopeId: string) => Promise<boolean>;
  checkNeoBalance: () => Promise<number>;
}

export function useNeoEligibility(): UseNeoEligibilityReturn {
  const { address, read } = useContractInteraction({
    appId: APP_ID,
    t: (key: string) => key,
  });

  const isEligible = ref(false);
  const neoBalance = ref(0);
  const holdingDays = ref(0);
  const reason = ref("");
  const checking = ref(false);

  /**
   * Check if user meets NEO holding requirements for a specific envelope.
   * Uses the contract's CheckEligibility method.
   */
  const checkEligibility = async (contractHash: string, envelopeId: string) => {
    if (!address.value) {
      isEligible.value = false;
      reason.value = "wallet not connected";
      return false;
    }

    checking.value = true;
    try {
      const data = (await read(
        "checkEligibility",
        [
          { type: "Integer", value: envelopeId },
          { type: "Hash160", value: address.value },
        ],
        contractHash
      )) as Record<string, unknown> | null;

      if (!data) {
        isEligible.value = false;
        reason.value = "failed to check";
        return false;
      }

      isEligible.value = Boolean(data.eligible);
      neoBalance.value = Number(data.neoBalance ?? 0);
      holdingDays.value = Number(data.holdDays ?? 0);
      reason.value = String(data.reason ?? "");

      return isEligible.value;
    } catch (e: unknown) {
      isEligible.value = false;
      reason.value = formatErrorMessage(e, "check failed");
      return false;
    } finally {
      checking.value = false;
    }
  };

  /**
   * Quick check: read NEO balance directly (no envelope context needed).
   */
  const checkNeoBalance = async () => {
    if (!address.value) return 0;
    try {
      const balance = Number((await read("balanceOf", [{ type: "Hash160", value: address.value }], NEO_HASH)) ?? 0);
      neoBalance.value = balance;
      return balance;
    } catch (e: unknown) {
      /* non-critical: NEO balance check */
      return 0;
    }
  };

  return {
    isEligible,
    neoBalance,
    holdingDays,
    reason,
    checking,
    checkEligibility,
    checkNeoBalance,
  };
}
