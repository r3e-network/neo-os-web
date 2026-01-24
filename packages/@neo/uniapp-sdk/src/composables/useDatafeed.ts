/**
 * useDatafeed - Price datafeed composable
 */
import { waitForSDK } from "../bridge";
import { useAsyncAction } from "./useAsyncAction";
import type { PriceResponse } from "../types";

export function useDatafeed() {
  const {
    isLoading,
    error,
    execute: getPrice,
  } = useAsyncAction(async (symbol: string): Promise<PriceResponse> => {
    if (!symbol || typeof symbol !== "string") {
      throw new Error("getPrice: symbol is required and must be a non-empty string");
    }
    const sdk = await waitForSDK();
    return await sdk.datafeed.getPrice(symbol);
  });

  return { isLoading, error, getPrice };
}
