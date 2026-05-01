/**
 * useSwapEngine -- React hook for token swap operations.
 *
 * Uses createObservable instead of Vue ref/computed.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, BalanceService, EventBus } from "@shared/services";
import { toFixedDecimals } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Token } from "@/types";

const NEO_TOKEN_TEMPLATE: Token = { symbol: "NEO", hash: BLOCKCHAIN_CONSTANTS.NEO_HASH, balance: 0, decimals: 0 };
const GAS_TOKEN_TEMPLATE: Token = { symbol: "GAS", hash: BLOCKCHAIN_CONSTANTS.GAS_HASH, balance: 0, decimals: 8 };
const SWAP_DEADLINE_SECONDS = 600;

export interface UseSwapEngineOptions {
  chain: ChainService;
  balance: BalanceService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSwapEngine({ chain, balance, eventBus, t }: UseSwapEngineOptions) {
  const fromToken = createObservable<Token>({ ...NEO_TOKEN_TEMPLATE });
  const toToken = createObservable<Token>({ ...GAS_TOKEN_TEMPLATE });
  const fromAmount = createObservable("");
  const toAmount = createObservable("");
  const exchangeRate = createObservable("");
  const rateLoading = createObservable(false);
  const loading = createObservable(false);
  const showSelector = createObservable(false);
  const selectorTarget = createObservable<"from" | "to">("from");
  const isSwapping = createObservable(false);
  let swapAnimTimer: ReturnType<typeof setTimeout> | null = null;

  function applyTokenBalances(neo: number, gas: number) {
    const ft = fromToken.get();
    const tt = toToken.get();
    if (ft.symbol === "NEO") fromToken.set({ ...ft, balance: neo });
    if (ft.symbol === "GAS") fromToken.set({ ...ft, balance: gas });
    if (tt.symbol === "NEO") toToken.set({ ...tt, balance: neo });
    if (tt.symbol === "GAS") toToken.set({ ...tt, balance: gas });
  }

  async function refreshBalances() {
    if (!chain.address.get()) { applyTokenBalances(0, 0); return; }
    try {
      const [neo, gas] = await Promise.all([balance.getNeoBalance(), balance.getGasBalance()]);
      applyTokenBalances(neo, gas);
    } catch (e) {
      console.warn("[useSwapEngine] refreshBalances failed:", e instanceof Error ? e.message : String(e));
    }
  }

  const availableTokens: Observable<Token[]> = {
    get: () => [
      { ...NEO_TOKEN_TEMPLATE, balance: fromToken.get().symbol === "NEO" ? fromToken.get().balance : toToken.get().symbol === "NEO" ? toToken.get().balance : 0 },
      { ...GAS_TOKEN_TEMPLATE, balance: fromToken.get().symbol === "GAS" ? fromToken.get().balance : toToken.get().symbol === "GAS" ? toToken.get().balance : 0 },
    ],
    set: () => {},
    subscribe: (fn) => { const u1 = fromToken.subscribe(fn); const u2 = toToken.subscribe(fn); return () => { u1(); u2(); }; },
  };

  const canSwap: Observable<boolean> = {
    get: () => {
      const rate = parseFloat(exchangeRate.get());
      const hasRate = Number.isFinite(rate) && rate > 0;
      const amount = parseFloat(fromAmount.get());
      return hasRate && amount > 0 && amount <= fromToken.get().balance;
    },
    set: () => {},
    subscribe: (fn) => { const u1 = exchangeRate.subscribe(fn); const u2 = fromAmount.subscribe(fn); const u3 = fromToken.subscribe(fn); return () => { u1(); u2(); u3(); }; },
  };

  const swapButtonText: Observable<string> = {
    get: () => {
      if (loading.get()) return t("swapping");
      if (!fromAmount.get()) return t("enterAmount");
      if (rateLoading.get()) return t("loadingRate");
      const rate = parseFloat(exchangeRate.get());
      if (!(Number.isFinite(rate) && rate > 0)) return t("rateUnavailable");
      if (parseFloat(fromAmount.get()) > fromToken.get().balance) return t("insufficientBalance");
      return `${t("tabSwap")} ${fromToken.get().symbol} ${t("swapArrow")} ${toToken.get().symbol}`;
    },
    set: () => {},
    subscribe: (fn) => { const u1 = loading.subscribe(fn); const u2 = fromAmount.subscribe(fn); const u3 = rateLoading.subscribe(fn); const u4 = exchangeRate.subscribe(fn); const u5 = fromToken.subscribe(fn); const u6 = toToken.subscribe(fn); return () => { u1(); u2(); u3(); u4(); u5(); u6(); }; },
  };

  const slippage: Observable<string> = { get: () => "0.5%", set: () => {}, subscribe: () => () => {} };
  const minReceived: Observable<string> = {
    get: () => { const amount = parseFloat(toAmount.get()) || 0; return (amount * 0.995).toFixed(4); },
    set: () => {},
    subscribe: (fn) => toAmount.subscribe(fn),
  };

  function setMaxAmount() {
    fromAmount.set(fromToken.get().balance.toString());
    onFromAmountChange();
  }

  async function loadExchangeRate() {
    if (rateLoading.get()) return;
    rateLoading.set(true);
    exchangeRate.set("");
    try {
      const sdk = await import("@shared/utils/wallet-sdk").then((m) => m.waitForSDK?.() || null);
      if (sdk?.datafeed?.getPrice) {
        const fromPrice = await sdk.datafeed.getPrice(`${fromToken.get().symbol}-USD`);
        const toPrice = await sdk.datafeed.getPrice(`${toToken.get().symbol}-USD`);
        if (fromPrice?.price && toPrice?.price) {
          const rate = parseFloat(fromPrice.price) / parseFloat(toPrice.price);
          if (Number.isFinite(rate) && rate > 0) {
            exchangeRate.set(rate.toFixed(6));
            onFromAmountChange();
            return;
          }
        }
      }
    } catch (e) {
      console.warn("[useSwapEngine] exchange rate load failed:", e instanceof Error ? e.message : String(e));
    } finally {
      rateLoading.set(false);
    }
  }

  function onFromAmountChange() {
    const amount = parseFloat(fromAmount.get()) || 0;
    const rate = parseFloat(exchangeRate.get());
    if (!Number.isFinite(rate) || rate <= 0) { toAmount.set(""); return; }
    toAmount.set((amount * rate).toFixed(4));
  }

  function swapTokens() {
    isSwapping.set(true);
    const temp = fromToken.get();
    fromToken.set(toToken.get());
    toToken.set(temp);
    fromAmount.set("");
    toAmount.set("");
    loadExchangeRate().catch(() => {});
    if (swapAnimTimer) clearTimeout(swapAnimTimer);
    swapAnimTimer = setTimeout(() => { isSwapping.set(false); swapAnimTimer = null; }, 300);
  }

  function openFromSelector() { selectorTarget.set("from"); showSelector.set(true); }
  function openToSelector() { selectorTarget.set("to"); showSelector.set(true); }
  function closeSelector() { showSelector.set(false); }

  function selectToken(token: Token) {
    if (selectorTarget.get() === "from") {
      if (token.symbol === toToken.get().symbol) swapTokens();
      else fromToken.set({ ...token });
    } else {
      if (token.symbol === fromToken.get().symbol) swapTokens();
      else toToken.set({ ...token });
    }
    closeSelector();
    loadExchangeRate().catch(() => {});
  }

  async function executeSwap() {
    if (!canSwap.get() || loading.get()) return;
    loading.set(true);
    try {
      await chain.ensureWallet();
      const sender = chain.address.get() as string;
      const ft = fromToken.get();
      const tt = toToken.get();
      const amountInt = toFixedDecimals(fromAmount.get(), ft.decimals);
      const expectedOutput = parseFloat(toAmount.get()) || 0;
      const minOutputAmount = expectedOutput * 0.995;
      const minOutputInt = toFixedDecimals(minOutputAmount.toString(), tt.decimals);
      const routerAddress = chain.contractAddress.get();
      if (!routerAddress) throw new Error(t("swapRouterUnavailable"));

      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS;
      const path = [
        { type: "Hash160" as const, value: ft.hash },
        { type: "Hash160" as const, value: tt.hash },
      ];

      await chain.invoke("swapTokenInForTokenOut", [
        { type: "Hash160", value: sender },
        { type: "Integer", value: amountInt },
        { type: "Integer", value: minOutputInt },
        { type: "Array", value: path } as unknown as { type: "Array"; value: string },
        { type: "Integer", value: String(deadline) },
      ], { waitForEvent: "SwapExecuted" });

      eventBus.emit("swap:success", { message: `${t("swapSuccess")}: ${parseFloat(fromAmount.get())} ${ft.symbol}` });
      fromAmount.set("");
      toAmount.set("");
      await refreshBalances();
    } catch (e) {
      eventBus.emit("swap:error", { message: e instanceof Error ? e.message : t("swapFailed") });
      throw e;
    } finally {
      loading.set(false);
    }
  }

  const loadAll = async () => { await Promise.all([refreshBalances(), loadExchangeRate()]); };
  const cleanup = () => { if (swapAnimTimer) { clearTimeout(swapAnimTimer); swapAnimTimer = null; } };

  return {
    fromToken, toToken, fromAmount, toAmount, exchangeRate, rateLoading, loading,
    showSelector, selectorTarget, isSwapping, availableTokens, canSwap,
    swapButtonText, slippage, minReceived, setMaxAmount, loadExchangeRate,
    swapTokens, openFromSelector, openToSelector, closeSelector, selectToken,
    executeSwap, refreshBalances, loadAll, cleanup,
  };
}
