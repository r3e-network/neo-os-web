/**
 * usePayments - Payments composable for uni-app
 */
import { waitForSDK } from "../bridge";
import { useAsyncAction } from "./useAsyncAction";
import type { PayGASResponse } from "../types";

export function usePayments(appId: string) {
  const {
    isLoading,
    error,
    execute: payGAS,
  } = useAsyncAction(async (amount: string, memo?: string): Promise<PayGASResponse> => {
    const numAmount = parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      throw new Error("Invalid amount: must be a positive number");
    }
    const sdk = await waitForSDK();
    return await sdk.payments.payGAS(appId, amount, memo);
  });

  return { isLoading, error, payGAS };
}
