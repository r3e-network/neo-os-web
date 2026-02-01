import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";

export function useDevTippingWallet(APP_ID: string) {
  const { address, connect, invokeContract, chainType, getContractAddress } = useWallet() as WalletSDK;
  const { processPayment, isLoading } = usePaymentFlow(APP_ID);
  
  const MIN_TIP = 0.001;
  const status = ref<{ msg: string; type: string } | null>(null);

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, (key: string) => key)) {
      throw new Error("Wrong chain");
    }
    const contract = await getContractAddress();
    if (!contract) throw new Error("Contract unavailable");
    return contract;
  };

  const sendTip = async (
    selectedDevId: number,
    tipAmount: string,
    tipMessage: string,
    tipperName: string,
    anonymous: boolean,
    t: Function,
    onSuccess?: () => void
  ) => {
    if (!selectedDevId || !tipAmount) return false;
    
    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }
      
      const contract = await ensureContractAddress();
      const amount = Number.parseFloat(tipAmount);
      
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(t("invalidAmount"));
      }
      if (amount < MIN_TIP) {
        throw new Error(t("minTip"));
      }
      
      const amountInt = toFixed8(tipAmount);
      const { receiptId, invoke } = await processPayment(String(amount), `tip:${selectedDevId}`);
      
      if (!receiptId) {
        throw new Error(t("receiptMissing"));
      }

      await invoke(
        "Tip",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: String(selectedDevId) },
          { type: "Integer", value: amountInt },
          { type: "String", value: tipMessage || "" },
          { type: "String", value: tipperName || "" },
          { type: "Boolean", value: anonymous },
          { type: "Integer", value: String(receiptId) },
        ],
        contract,
      );

      status.value = { msg: t("tipSent"), type: "success" };
      if (onSuccess) onSuccess();
      return true;
    } catch (e: any) {
      status.value = { msg: e.message || t("error"), type: "error" };
      return false;
    }
  };

  return {
    address,
    isLoading,
    status,
    sendTip,
    ensureContractAddress,
  };
}
