/**
 * useDevTippingWallet — Wallet interaction logic for the Dev Tipping miniapp
 *
 * Receives ChainService + EventBus from PlatformServices instead of
 * instantiating its own useContractInteraction / useStatusMessage.
 */

import { ref } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { toFixed8 } from "@shared/utils/format";

const MIN_TIP = 0.001;

export interface UseDevTippingWalletOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useDevTippingWallet({ chain, eventBus, t }: UseDevTippingWalletOptions) {
  const isLoading = ref(false);

  const sendTip = async (
    selectedDevId: number,
    tipAmount: string,
    tipMessage: string,
    tipperName: string,
    anonymous: boolean,
    onSuccess?: () => void,
  ) => {
    if (!selectedDevId || !tipAmount) return false;

    isLoading.value = true;
    try {
      await chain.ensureWallet();

      const amount = Number.parseFloat(tipAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(t("invalidAmount"));
      }
      if (amount < MIN_TIP) {
        throw new Error(t("minTip"));
      }

      const amountInt = toFixed8(tipAmount);

      await chain.invokeWithPayment(
        amountInt,
        `miniapp-dev-tipping:tip:${selectedDevId}`,
        "Tip",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: String(selectedDevId) },
          { type: "Integer", value: amountInt },
          { type: "String", value: tipMessage || "" },
          { type: "String", value: tipperName || "" },
          { type: "Boolean", value: anonymous },
        ],
      );

      eventBus.emit("devtipping:tipsent", { devId: selectedDevId, amount });
      if (onSuccess) onSuccess();
      return true;
    } catch (e) {
      eventBus.emit("devtipping:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    address: chain.address,
    isLoading,
    sendTip,
  };
}
