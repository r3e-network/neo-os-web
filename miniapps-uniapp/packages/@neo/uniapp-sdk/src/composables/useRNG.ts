/**
 * useRNG - Random Number Generator composable
 */
import { ref } from "vue";
import { waitForSDK } from "../bridge";
import type { RNGResponse } from "../types";

export function useRNG(appId: string) {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const requestRandom = async (): Promise<RNGResponse> => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      return await sdk.rng.requestRandom(appId);
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  return { isLoading, error, requestRandom };
}
