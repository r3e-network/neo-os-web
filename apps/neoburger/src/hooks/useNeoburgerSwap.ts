/**
 * useNeoburgerSwap -- React hook for NeoBurger swap UI logic.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";
import { toFixedDecimals, toFixed8 } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { PriceData } from "@shared/utils/price";

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;

export interface UseNeoburgerSwapOptions {
  chain: ChainService;
  eventBus: EventBus;
  neoBalance: Observable<number>;
  bNeoBalance: Observable<number>;
  BNEO_CONTRACT: Observable<string | null>;
  priceData: Observable<PriceData | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
  loadBalances: () => Promise<void>;
}

export function useNeoburgerSwap({ chain, eventBus, neoBalance, bNeoBalance, BNEO_CONTRACT, priceData, t, loadBalances }: UseNeoburgerSwapOptions) {
  const swapMode = createObservable<string>("stake");
  const swapAmount = createObservable("");
  const swapOutput = createObservable("");
  const swapUsdText = createObservable("");

  const swapCanSubmit: Observable<boolean> = {
    get: () => {
      const amount = parseFloat(swapAmount.get());
      if (!Number.isFinite(amount) || amount <= 0) return false;
      const bal = swapMode.get() === "stake" ? neoBalance.get() : bNeoBalance.get();
      return amount <= bal;
    },
    set: () => {},
    subscribe: (fn) => {
      const u1 = swapAmount.subscribe(fn); const u2 = swapMode.subscribe(fn);
      const u3 = neoBalance.subscribe(fn); const u4 = bNeoBalance.subscribe(fn);
      return () => { u1(); u2(); u3(); u4(); };
    },
  };

  const executeSwap = async () => {
    await chain.ensureWallet();
    const contractAddr = BNEO_CONTRACT.get() ?? chain.contractAddress.value;
    if (!contractAddr) throw new Error(t("contractUnavailable"));

    const amount = parseFloat(swapAmount.get());
    if (!amount || amount <= 0) throw new Error(t("enterAmount"));

    if (swapMode.get() === "stake") {
      const intAmount = Math.floor(amount);
      await chain.invoke("transfer", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Hash160", value: contractAddr },
        { type: "Integer", value: intAmount },
      ], { scriptHash: NEO_CONTRACT });
    } else {
      const fixed = toFixed8(amount);
      await chain.invoke("transfer", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Hash160", value: contractAddr },
        { type: "Integer", value: fixed },
      ], { scriptHash: contractAddr });
    }

    swapAmount.set("");
    swapOutput.set("");
    await loadBalances();
    return { success: true };
  };

  return { swapMode, swapAmount, swapOutput, swapUsdText, swapCanSubmit, executeSwap };
}
