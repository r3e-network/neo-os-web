/**
 * useRNG - Random Number Generator composable
 */
import { waitForSDK } from "../bridge";
import { useAsyncAction } from "./useAsyncAction";
import type { RNGResponse } from "../types";

export function useRNG(appId: string) {
  if (!appId || typeof appId !== "string") {
    throw new Error("useRNG: appId is required and must be a non-empty string");
  }

  const {
    isLoading,
    error,
    execute: requestRandom,
  } = useAsyncAction(async (): Promise<RNGResponse> => {
    const sdk = await waitForSDK();
    return await sdk.rng.requestRandom(appId);
  });

  return { isLoading, error, requestRandom };
}
