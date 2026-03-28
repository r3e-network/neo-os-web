/**
 * useSwapEngine — Token swap operations, balance tracking, and price estimation.
 *
 * Receives ChainService + BalanceService + EventBus from PlatformServices.
 * Replaces the legacy version that wired useWallet + useStatusMessage +
 * useWalletBalanceReader + useContractAddress directly.
 */

import { ref, computed } from "vue";
import type { ChainService, BalanceService, EventBus } from "@shared/services";
import { toFixedDecimals } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Token } from "@/types";

const NEO_TOKEN_TEMPLATE: Token = { symbol: "NEO", hash: BLOCKCHAIN_CONSTANTS.NEO_HASH, balance: 0, decimals: 0 };
const GAS_TOKEN_TEMPLATE: Token = { symbol: "GAS", hash: BLOCKCHAIN_CONSTANTS.GAS_HASH, balance: 0, decimals: 8 };

/** Swap transaction deadline in seconds (10 minutes). */
const SWAP_DEADLINE_SECONDS = 600;

export interface UseSwapEngineOptions {
  chain: ChainService;
  balance: BalanceService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSwapEngine({ chain, balance, eventBus, t }: UseSwapEngineOptions) {
  // Instance-level token state
  const fromToken = ref<Token>({ ...NEO_TOKEN_TEMPLATE });
  const toToken = ref<Token>({ ...GAS_TOKEN_TEMPLATE });
  const fromAmount = ref("");
  const toAmount = ref("");
  const exchangeRate = ref("");
  const rateLoading = ref(false);
  const loading = ref(false);
  const showSelector = ref(false);
  const selectorTarget = ref<"from" | "to">("from");
  const isSwapping = ref(false);
  let swapAnimTimer: ReturnType<typeof setTimeout> | null = null;

  function applyTokenBalances(neo: number, gas: number) {
    if (fromToken.value.symbol === "NEO") fromToken.value.balance = neo;
    if (fromToken.value.symbol === "GAS") fromToken.value.balance = gas;
    if (toToken.value.symbol === "NEO") toToken.value.balance = neo;
    if (toToken.value.symbol === "GAS") toToken.value.balance = gas;
  }

  async function refreshBalances() {
    if (!chain.address.value) {
      applyTokenBalances(0, 0);
      return;
    }

    try {
      const [neo, gas] = await Promise.all([
        balance.getNeoBalance(),
        balance.getGasBalance(),
      ]);
      applyTokenBalances(neo, gas);
    } catch (e) {
      console.warn("[useSwapEngine] refreshBalances failed:", e instanceof Error ? e.message : String(e));
    }
  }

  const availableTokens = computed<Token[]>(() => [
    { ...NEO_TOKEN_TEMPLATE, balance: fromToken.value.symbol === "NEO" ? fromToken.value.balance : toToken.value.symbol === "NEO" ? toToken.value.balance : 0 },
    { ...GAS_TOKEN_TEMPLATE, balance: fromToken.value.symbol === "GAS" ? fromToken.value.balance : toToken.value.symbol === "GAS" ? toToken.value.balance : 0 },
  ]);
  const hasRate = computed(() => {
    const rate = parseFloat(exchangeRate.value);
    return Number.isFinite(rate) && rate > 0;
  });
  const canSwap = computed(() => {
    const amount = parseFloat(fromAmount.value);
    return hasRate.value && amount > 0 && amount <= fromToken.value.balance;
  });
  const swapButtonText = computed(() => {
    if (loading.value) return t("swapping");
    if (!fromAmount.value) return t("enterAmount");
    if (rateLoading.value) return t("loadingRate");
    if (!hasRate.value) return t("rateUnavailable");
    if (parseFloat(fromAmount.value) > fromToken.value.balance) return t("insufficientBalance");
    return `${t("tabSwap")} ${fromToken.value.symbol} ${t("swapArrow")} ${toToken.value.symbol}`;
  });
  const slippage = computed(() => "0.5%");
  const minReceived = computed(() => {
    const amount = parseFloat(toAmount.value) || 0;
    return (amount * 0.995).toFixed(4);
  });

  function setMaxAmount() {
    fromAmount.value = fromToken.value.balance.toString();
    onFromAmountChange();
  }

  async function loadExchangeRate() {
    if (rateLoading.value) return;
    rateLoading.value = true;
    exchangeRate.value = "";
    try {
      const sdk = await import("@shared/utils/wallet-sdk").then((m) => m.waitForSDK?.() || null);
      if (sdk?.datafeed?.getPrice) {
        const fromPrice = await sdk.datafeed.getPrice(`${fromToken.value.symbol}-USD`);
        const toPrice = await sdk.datafeed.getPrice(`${toToken.value.symbol}-USD`);
        if (fromPrice?.price && toPrice?.price) {
          const rate = parseFloat(fromPrice.price) / parseFloat(toPrice.price);
          if (Number.isFinite(rate) && rate > 0) {
            exchangeRate.value = rate.toFixed(6);
            onFromAmountChange();
            return;
          }
        }
      }
    } catch (e) {
      console.warn("[useSwapEngine] exchange rate load failed:", e instanceof Error ? e.message : String(e));
    } finally {
      rateLoading.value = false;
    }
  }

  function onFromAmountChange() {
    const amount = parseFloat(fromAmount.value) || 0;
    const rate = parseFloat(exchangeRate.value);
    if (!Number.isFinite(rate) || rate <= 0) {
      toAmount.value = "";
      return;
    }
    toAmount.value = (amount * rate).toFixed(4);
  }

  function swapTokens() {
    isSwapping.value = true;
    const temp = fromToken.value;
    fromToken.value = toToken.value;
    toToken.value = temp;
    fromAmount.value = "";
    toAmount.value = "";
    loadExchangeRate().catch((e: unknown) => {
      console.warn("[useSwapEngine] loadExchangeRate failed after swapTokens:", e instanceof Error ? e.message : String(e));
    });
    if (swapAnimTimer) clearTimeout(swapAnimTimer);
    swapAnimTimer = setTimeout(() => {
      isSwapping.value = false;
      swapAnimTimer = null;
    }, 300);
  }

  function openFromSelector() {
    selectorTarget.value = "from";
    showSelector.value = true;
  }

  function openToSelector() {
    selectorTarget.value = "to";
    showSelector.value = true;
  }

  function closeSelector() {
    showSelector.value = false;
  }

  function selectToken(token: Token) {
    if (selectorTarget.value === "from") {
      if (token.symbol === toToken.value.symbol) swapTokens();
      else fromToken.value = { ...token };
    } else {
      if (token.symbol === fromToken.value.symbol) swapTokens();
      else toToken.value = { ...token };
    }
    closeSelector();
    loadExchangeRate().catch((e: unknown) => {
      console.warn("[useSwapEngine] loadExchangeRate failed after selectToken:", e instanceof Error ? e.message : String(e));
    });
  }

  async function executeSwap() {
    if (!canSwap.value || loading.value) return;
    loading.value = true;
    try {
      await chain.ensureWallet();
      const sender = chain.address.value as string;
      const amountInt = toFixedDecimals(fromAmount.value, fromToken.value.decimals);
      const expectedOutput = parseFloat(toAmount.value) || 0;
      const slippageTolerance = 0.005;
      const minOutputAmount = expectedOutput * (1 - slippageTolerance);
      const toDecimals = toToken.value.decimals;
      const minOutputInt = toFixedDecimals(minOutputAmount.toString(), toDecimals);
      const routerAddress = chain.contractAddress.value;
      if (!routerAddress) throw new Error(t("swapRouterUnavailable"));

      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS;
      const path = [
        { type: "Hash160" as const, value: fromToken.value.hash },
        { type: "Hash160" as const, value: toToken.value.hash },
      ];

      await chain.invoke(
        "swapTokenInForTokenOut",
        [
          { type: "Hash160", value: sender },
          { type: "Integer", value: amountInt },
          { type: "Integer", value: minOutputInt },
          { type: "Array", value: path } as unknown as { type: "Array"; value: string },
          { type: "Integer", value: String(deadline) },
        ],
        { waitForEvent: "SwapExecuted" },
      );

      eventBus.emit("swap:success", {
        message: `${t("swapSuccess")}: ${parseFloat(fromAmount.value)} ${fromToken.value.symbol}`,
      });
      fromAmount.value = "";
      toAmount.value = "";
      await refreshBalances();
    } catch (e) {
      eventBus.emit("swap:error", {
        message: e instanceof Error ? e.message : t("swapFailed"),
      });
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Load all data — called by defineMiniApp on mount.
   */
  const loadAll = async () => {
    await Promise.all([
      refreshBalances(),
      loadExchangeRate(),
    ]);
  };

  /**
   * Cleanup — stop timers.
   */
  const cleanup = () => {
    if (swapAnimTimer) {
      clearTimeout(swapAnimTimer);
      swapAnimTimer = null;
    }
  };

  return {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    exchangeRate,
    rateLoading,
    loading,
    showSelector,
    selectorTarget,
    isSwapping,
    availableTokens,
    canSwap,
    swapButtonText,
    slippage,
    minReceived,
    setMaxAmount,
    loadExchangeRate,
    swapTokens,
    openFromSelector,
    openToSelector,
    closeSelector,
    selectToken,
    executeSwap,
    refreshBalances,
    loadAll,
    cleanup,
  };
}
