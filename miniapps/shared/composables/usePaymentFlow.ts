/**
 * Payment Flow Composable
 *
 * Standardizes the payment flow process:
 * 1. Check wallet connection
 * 2. Pay GAS (if needed)
 * 3. Get receipt ID
 * 4. Invoke contract operation
 * 5. Wait for event confirmation
 */

import { ref } from "vue";
import { usePayments, useWallet, useEvents } from "@neo/uniapp-sdk";
import { pollForEvent } from "@shared/utils/errorHandling";

export function usePaymentFlow(appId: string) {
  const { payGAS } = usePayments();
  const { address, connect, invokeContract } = useWallet() as any;
  const { list: listEvents } = useEvents();

  const isProcessing = ref(false);
  const error = ref<Error | null>(null);

  /**
   * Process the complete payment flow
   */
  const processPayment = async (amount: string, memo: string) => {
    try {
      // Ensure wallet is connected
      if (!address.value) {
        await connect();
      }

      if (!address.value) {
        throw new Error("Wallet not connected");
      }

      isProcessing.value = true;
      error.value = null;

      // Step 1: Pay GAS
      const payment = await payGAS(amount, memo);
      const receiptId = payment.receipt_id || "";

      // Step 2: Return invoke function with receipt context
      const invoke = async (
        scriptHash: string,
        operation: string,
        args: unknown[],
      ) => {
        const tx = (await invokeContract({
          scriptHash,
          operation,
          args,
        })) as { txid?: string; txHash?: string };

        const txid = tx.txid || tx.txHash || "";
        return { txid, receiptId };
      };

      // Step 3: Return waitForEvent function
      const waitForEvent = async (
        txid: string,
        eventName: string,
        timeoutMs = 30000,
      ) => {
        return pollForEvent(
          async () => {
            const result = await listEvents({
              app_id: appId,
              event_name: eventName,
              limit: 20,
            });
            return result.events || [];
          },
          (event) => event.tx_hash === txid,
          {
            timeoutMs,
            errorMessage: `Event "${eventName}" not found for transaction ${txid}`,
          },
        );
      };

      return { receiptId, invoke, waitForEvent };
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      throw err;
    } finally {
      isProcessing.value = false;
    }
  };

  return {
    isProcessing,
    error,
    processPayment,
  };
}
