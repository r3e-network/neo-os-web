/**
 * useDevTippingWallet — Wallet interaction logic for the Dev Tipping miniapp
 *
 * Uses OS PaymentProxy for tip deposits instead of direct
 * chain.invokeWithPayment(). The edge function behind PaymentProxy
 * handles the GAS transfer + contract invocation atomically.
 * Chain/EventBus are still used for wallet connection and notifications.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import { toFixed8 } from "@shared/utils/format";

const MIN_TIP = 0.001;

export interface UseDevTippingWalletOptions {
  chain: ChainService;
  eventBus: EventBus;
  payment: PaymentProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useDevTippingWallet({ chain, eventBus, payment, t }: UseDevTippingWalletOptions) {
  const isLoading = createObservable(false);

  const sendTip = async (
    selectedDevId: number,
    tipAmount: string,
    tipMessage: string,
    tipperName: string,
    anonymous: boolean,
    onSuccess?: () => void,
  ) => {
    if (!selectedDevId || !tipAmount) return false;

    isLoading.set(true);
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

      // Deposit via OS payment proxy — the edge function handles
      // GAS transfer + contract Tip invocation atomically
      const memo = JSON.stringify({
        action: "tip",
        devId: selectedDevId,
        message: tipMessage || "",
        tipper: tipperName || "",
        anonymous,
      });
      await payment.deposit(amountInt, memo);

      eventBus.emit("devtipping:tipsent", { devId: selectedDevId, amount });
      if (onSuccess) onSuccess();
      return true;
    } catch (e) {
      eventBus.emit("devtipping:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  return {
    address: chain.address,
    isLoading,
    sendTip,
  };
}
