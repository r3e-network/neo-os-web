/**
 * useDatafeed - Price datafeed composable
 */
import { waitForSDK } from "../bridge";
import { useAsyncAction } from "./useAsyncAction";
import type { PriceResponse } from "../types";

export function useDatafeed() {
  const getPriceAction = useAsyncAction(async (symbol: string): Promise<PriceResponse> => {
    if (!symbol || typeof symbol !== "string") {
      throw new Error("getPrice: symbol is required and must be a non-empty string");
    }
    const sdk = await waitForSDK();
    return await sdk.datafeed.getPrice(symbol);
  });

  const getPricesAction = useAsyncAction(async () => {
    const sdk = await waitForSDK();
    if (!sdk.datafeed?.getPrices) {
      throw new Error("datafeed.getPrices not available");
    }
    return await sdk.datafeed.getPrices();
  });

  const getNetworkStatsAction = useAsyncAction(async () => {
    const sdk = await waitForSDK();
    if (!sdk.datafeed?.getNetworkStats) {
      throw new Error("datafeed.getNetworkStats not available");
    }
    return await sdk.datafeed.getNetworkStats();
  });

  const getRecentTransactionsAction = useAsyncAction(async (limit?: number) => {
    const sdk = await waitForSDK();
    if (!sdk.datafeed?.getRecentTransactions) {
      throw new Error("datafeed.getRecentTransactions not available");
    }
    return await sdk.datafeed.getRecentTransactions(limit);
  });

  return {
    isLoading: getPriceAction.isLoading,
    error: getPriceAction.error,
    getPrice: getPriceAction.execute,
    isLoadingPrices: getPricesAction.isLoading,
    pricesError: getPricesAction.error,
    getPrices: getPricesAction.execute,
    isLoadingNetworkStats: getNetworkStatsAction.isLoading,
    networkStatsError: getNetworkStatsAction.error,
    getNetworkStats: getNetworkStatsAction.execute,
    isLoadingRecentTransactions: getRecentTransactionsAction.isLoading,
    recentTransactionsError: getRecentTransactionsAction.error,
    getRecentTransactions: getRecentTransactionsAction.execute,
  };
}
