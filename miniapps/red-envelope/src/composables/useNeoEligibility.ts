import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";

const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

export function useNeoEligibility() {
  const { address, invokeRead } = useWallet() as WalletSDK;

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
      const res = await invokeRead({
        scriptHash: contractHash,
        operation: "checkEligibility",
        args: [
          { type: "Integer", value: envelopeId },
          { type: "Hash160", value: address.value },
        ],
      });

      const data = parseInvokeResult(res) as Record<string, unknown> | null;
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
      reason.value = "check failed";
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
      const res = await invokeRead({
        scriptHash: NEO_HASH,
        operation: "balanceOf",
        args: [{ type: "Hash160", value: address.value }],
      });
      const balance = Number(parseInvokeResult(res) ?? 0);
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
