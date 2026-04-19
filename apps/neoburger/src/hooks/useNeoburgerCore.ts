/**
 * useNeoburgerCore -- React hook for NeoBurger core staking logic.
 *
 * Uses createObservable instead of Vue ref/computed.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus, BalanceService } from "@shared/services";
import { toFixedDecimals, toFixed8 } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const BNEO_DECIMALS = TOKEN_CONSTANTS.GAS_DECIMALS;

export interface UseNeoburgerCoreOptions {
  chain: ChainService;
  eventBus: EventBus;
  balance: BalanceService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useNeoburgerCore({ chain, eventBus, balance, t }: UseNeoburgerCoreOptions) {
  const neoBalance = createObservable<number>(0);
  const bNeoBalance = createObservable<number>(0);
  const walletConnected = createObservable(false);
  const BNEO_CONTRACT = createObservable<string | null>(null);

  const loadBalances = async (silent = true) => {
    if (!chain.address.value) {
      neoBalance.set(0);
      bNeoBalance.set(0);
      walletConnected.set(false);
      return;
    }
    walletConnected.set(true);
    try {
      const [neo, gas] = await Promise.all([
        balance.getNeoBalance(),
        balance.getGasBalance(),
      ]);
      neoBalance.set(neo);
      bNeoBalance.set(gas);
    } catch (e) {
      if (!silent) console.warn("[useNeoburgerCore] loadBalances failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const connectWallet = async () => {
    await chain.ensureWallet();
    walletConnected.set(true);
    await loadBalances(false);
  };

  const handleClaimRewards = async () => {
    await chain.ensureWallet();
    const contractAddr = chain.contractAddress.value;
    if (!contractAddr) throw new Error(t("contractUnavailable"));
    const account = chain.address.value;
    if (!account) throw new Error(t("walletNotConnected"));
    // BurgerNEO mainnet ABI exposes `reward(account: Hash160)`, not
    // `claimReward()`. Calling the wrong name FAULTed with
    // "method not found"; the contract has no claimReward in its ABI.
    await chain.invoke("reward", [
      { type: "Hash160", value: account },
    ], { scriptHash: contractAddr });
    return { success: true };
  };

  return {
    neoBalance,
    bNeoBalance,
    walletConnected,
    BNEO_CONTRACT,
    loadBalances,
    connectWallet,
    handleClaimRewards,
  };
}
