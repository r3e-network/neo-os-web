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

type InvokeArg = {
  type: string;
  value: string | number | boolean;
};

export interface PaymentFlowOptions {
  /** Callback fired after successful payment flow completion */
  onSuccess?: () => void;
}

export function usePaymentFlow(appId: string, options?: PaymentFlowOptions) {
  const { payGAS } = usePayments(appId);
  const { address, connect, invokeContract } = useWallet();
  const { list: listEvents } = useEvents();

  const isProcessing = ref(false);
  const error = ref<Error | null>(null);
  /** Briefly true after a successful payment — bind to Fireworks :active */
  const success = ref(false);

  /**
   * Process the complete payment flow
   */
  const processPayment = async (amount: string, memo: string) => {
    try {
      if (!address.value) {
        await connect();
      }

      if (!address.value) {
        throw new Error("Wallet not connected");
      }

      isProcessing.value = true;
      error.value = null;

      const payment = await payGAS(amount, memo);
      const receiptId = payment.receipt_id || "";

      const invoke = async (first: string, second: string | InvokeArg[], third?: InvokeArg[] | string) => {
        let scriptHash: string;
        let operation: string;
        let args: InvokeArg[];

        if (typeof second === "string" && Array.isArray(third)) {
          scriptHash = first;
          operation = second;
          args = third;
        } else if (Array.isArray(second) && typeof third === "string") {
          operation = first;
          args = second;
          scriptHash = third;
        } else {
          throw new Error("Invalid invoke signature");
        }

        const tx = (await invokeContract({
          scriptHash,
          operation,
          args,
        })) as { txid?: string; txHash?: string };

        const txid = tx.txid || tx.txHash || "";
        return { txid, receiptId };
      };

      const waitForEvent = async (txid: string, eventName: string, timeoutMs = 30000) => {
        return pollForEvent(
          async () => {
            const result = await listEvents({
              app_id: appId,
              event_name: eventName,
              limit: 20,
            });
            return result.events || [];
          },
          (event: { tx_hash?: string }) => event.tx_hash === txid,
          {
            timeoutMs,
            errorMessage: `Event "${eventName}" not found for transaction ${txid}`,
          }
        );
      };

      /** Signal success — sets success ref and calls onSuccess callback */
      const triggerSuccess = () => {
        success.value = true;
        options?.onSuccess?.();
        setTimeout(() => {
          success.value = false;
        }, 3500);
      };

      return { receiptId, invoke, waitForEvent, triggerSuccess };
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      throw err;
    } finally {
      isProcessing.value = false;
    }
  };

  return {
    isProcessing,
    isLoading: isProcessing,
    error,
    success,
    processPayment,
  };
}
