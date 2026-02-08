import { ref } from "vue";
import { useWallet } from "./useWallet";
import { CONTRACT_HASH } from "./useRedEnvelope";
import { parseInvokeResult } from "@/utils/neo";

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
  neoBalance: number;
  holdDays: number;
  minNeoRequired: number;
  minHoldSeconds: number;
};

export function useNeoEligibility() {
  const { address, invokeRead } = useWallet();

  const checking = ref(false);
  const result = ref<EligibilityResult | null>(null);

  const checkEligibility = async (envelopeId: string): Promise<EligibilityResult> => {
    checking.value = true;
    try {
      const res = await invokeRead({
        scriptHash: CONTRACT_HASH,
        operation: "checkEligibility",
        args: [
          { type: "Integer", value: envelopeId },
          { type: "Hash160", value: address.value },
        ],
      });

      const data = parseInvokeResult(res) as Record<string, unknown>;
      const r: EligibilityResult = {
        eligible: Boolean(data?.eligible),
        reason: String(data?.reason ?? "unknown"),
        neoBalance: Number(data?.neoBalance ?? 0),
        holdDays: Number(data?.holdDays ?? 0),
        minNeoRequired: Number(data?.minNeoRequired ?? 0),
        minHoldSeconds: Number(data?.minHoldSeconds ?? 0),
      };
      result.value = r;
      return r;
    } finally {
      checking.value = false;
    }
  };

  return { checking, result, checkEligibility };
}
