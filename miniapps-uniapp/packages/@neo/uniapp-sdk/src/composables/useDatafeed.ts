/**
 * useDatafeed - Price datafeed composable
 */
import { ref } from "vue";
import { waitForSDK } from "../bridge";
import type { PriceResponse } from "../types";

export function useDatafeed() {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const getPrice = async (symbol: string): Promise<PriceResponse> => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      return await sdk.datafeed.getPrice(symbol);
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  return { isLoading, error, getPrice };
}
