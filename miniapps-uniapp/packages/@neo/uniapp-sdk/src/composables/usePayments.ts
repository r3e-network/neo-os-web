/**
 * usePayments - Payments composable for uni-app
 */
import { ref } from "vue";
import { getSDKSync, waitForSDK } from "../bridge";
import type { PayGASResponse } from "../types";

export function usePayments(appId: string) {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const payGAS = async (amount: string, memo?: string): Promise<PayGASResponse> => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      return await sdk.payments.payGAS(appId, amount, memo);
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  return { isLoading, error, payGAS };
}
