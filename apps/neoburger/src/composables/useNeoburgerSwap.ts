/**
 * useNeoburgerSwap — Swap UI logic for the NeoBurger miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Manages stake/unstake swap interface state and execution.
 */

import { ref, computed, type Ref } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { toFixedDecimals, toFixed8 } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;

export interface UseNeoburgerSwapOptions {
  chain: ChainService;
  eventBus: EventBus;
  neoBalance: Ref<number>;
  bNeoBalance: Ref<number>;
  BNEO_CONTRACT: Ref<string | null>;
  priceData: Ref<{ neo: { usd: number } } | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
  loadBalances: () => Promise<void>;
}

export function useNeoburgerSwap({
  chain,
  eventBus,
  neoBalance,
  bNeoBalance,
  BNEO_CONTRACT,
  priceData,
  t,
  loadBalances,
}: UseNeoburgerSwapOptions) {
  const stakeAmount = ref("");
  const unstakeAmount = ref("");
  const swapMode = ref<"stake" | "unstake">("stake");

  const swapAmount = computed({
    get: () => (swapMode.value === "stake" ? stakeAmount.value : unstakeAmount.value),
    set: (value: string) => {
      if (swapMode.value === "stake") {
        stakeAmount.value = sanitizeStakeInput(value);
      } else {
        unstakeAmount.value = value;
      }
    },
  });

  const swapOutput = computed(() => {
    const amount = parseFloat(swapAmount.value);
    if (!amount) return t("placeholderDash");
    return swapMode.value === "stake" ? estimatedBneo.value : estimatedNeo.value;
  });

  const swapCanSubmit = computed(() => (swapMode.value === "stake" ? canStake.value : canUnstake.value));

  const swapButtonLabel = computed(() => (swapMode.value === "stake" ? t("swapToBneo") : t("swapToNeo")));

  const swapUsdText = computed(() => {
    const price = priceData.value?.neo.usd ?? 0;
    const rawAmount = Number.parseFloat(swapAmount.value);
    const stakeAmountInt = Number(toFixedDecimals(swapAmount.value, 0));
    const amount = swapMode.value === "stake" ? stakeAmountInt : rawAmount || 0;
    if (!price || !amount) return t("approxUsdPlaceholder");
    return t("approxUsd", { value: (amount * price).toFixed(2) });
  });

  const canStake = computed(() => {
    const amount = Number(toFixedDecimals(stakeAmount.value, 0));
    return amount > 0 && amount <= neoBalance.value;
  });

  const canUnstake = computed(() => {
    const amount = parseFloat(unstakeAmount.value);
    return amount > 0 && amount <= bNeoBalance.value;
  });

  const estimatedBneo = computed(() => {
    const amount = Number(toFixedDecimals(stakeAmount.value, 0));
    return (amount * 0.99).toFixed(2);
  });

  const estimatedNeo = computed(() => {
    const amount = parseFloat(unstakeAmount.value) || 0;
    return (amount * 1.01).toFixed(2);
  });

  function sanitizeStakeInput(value: string): string {
    if (!value) return "";
    const parsed = Number(toFixedDecimals(value, 0));
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    return String(parsed);
  }

  function updateSwapAmount(value: string) {
    swapAmount.value = value;
  }

  function toggleSwapMode() {
    swapMode.value = swapMode.value === "stake" ? "unstake" : "stake";
  }

  function setStakeAmount(percentage: number) {
    stakeAmount.value = String(Math.floor(neoBalance.value * percentage));
  }

  function setUnstakeAmount(percentage: number) {
    unstakeAmount.value = (bNeoBalance.value * percentage).toFixed(2);
  }

  function setSwapAmount(percentage: number) {
    if (swapMode.value === "stake") {
      setStakeAmount(percentage);
    } else {
      setUnstakeAmount(percentage);
    }
  }

  async function executeStake() {
    if (!canStake.value) return false;

    const amount = Number(toFixedDecimals(stakeAmount.value, 0));
    const bneoContract = BNEO_CONTRACT.value;
    if (!bneoContract) return false;

    const addr = await chain.ensureWallet();
    await chain.invoke("transfer", [
      { type: "Hash160", value: addr },
      { type: "Hash160", value: bneoContract },
      { type: "Integer", value: Math.floor(amount) },
    ], { scriptHash: NEO_CONTRACT });

    eventBus.emit("stake:completed", { amount });
    stakeAmount.value = "";
    await loadBalances();
    return true;
  }

  async function executeUnstake() {
    if (!canUnstake.value) return false;

    const integerAmount = toFixed8(unstakeAmount.value);
    const bneoContract = BNEO_CONTRACT.value;
    if (!bneoContract) return false;

    const addr = await chain.ensureWallet();
    await chain.invoke("transfer", [
      { type: "Hash160", value: addr },
      { type: "Hash160", value: bneoContract },
      { type: "Integer", value: integerAmount },
    ], { scriptHash: bneoContract });

    eventBus.emit("unstake:completed", {});
    unstakeAmount.value = "";
    await loadBalances();
    return true;
  }

  async function executeSwap() {
    if (swapMode.value === "stake") {
      return executeStake();
    } else {
      return executeUnstake();
    }
  }

  return {
    swapMode,
    stakeAmount,
    unstakeAmount,
    swapAmount,
    swapOutput,
    swapCanSubmit,
    swapButtonLabel,
    swapUsdText,
    canStake,
    canUnstake,
    estimatedBneo,
    estimatedNeo,
    updateSwapAmount,
    toggleSwapMode,
    setSwapAmount,
    executeSwap,
    executeStake,
    executeUnstake,
  };
}

export type UseNeoburgerSwapReturn = ReturnType<typeof useNeoburgerSwap>;
