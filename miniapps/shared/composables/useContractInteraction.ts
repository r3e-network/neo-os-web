/**
 * Standard Contract Interaction Composable
 *
 * Provides typed contract invocation with loading state,
 * error handling, and automatic result parsing.
 *
 * @example
 * ```ts
 * const { invoke, read, isLoading, error } = useContractInteraction(scriptHash);
 *
 * const result = await invoke("transfer", [
 *   { type: "Hash160", value: toAddress },
 *   { type: "Integer", value: amount }
 * ]);
 *
 * if (result.success) {
 *   const txid = result.data;
 * }
 * ```
 */

import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import { handleAsync } from "@shared/utils/errorHandling";
import type { InvokeResult as WalletInvokeResult } from "@neo/types";

export interface ContractArg {
  type: string;
  value: unknown;
}

export interface InvokeOptions {
  /** Show loading state during invocation */
  setLoading?: boolean;
  /** Context for error messages */
  context?: string;
  /** Custom error handler */
  onError?: (error: Error) => void;
}

export interface InvokeResult<T = unknown> {
  success: true;
  data: T;
}

export interface InvokeError {
  success: false;
  error: Error;
}

type ContractCallResult<T = unknown> = InvokeResult<T> | InvokeError;

export function useContractInteraction(scriptHash: string) {
  const { invokeContract, invokeRead } = useWallet();

  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  /**
   * Invoke a contract write operation
   */
  const invoke = async <T = unknown>(
    operation: string,
    args: ContractArg[],
    options: InvokeOptions = {}
  ): Promise<ContractCallResult<T>> => {
    const { setLoading: shouldSetLoading = true, context, onError } = options;

    if (shouldSetLoading) {
      isLoading.value = true;
    }

    return handleAsync(
      async () => {
        const result = await invokeContract({
          scriptHash,
          operation,
          args,
        });

        // Extract txid/hash from result
        const data = (result as WalletInvokeResult)?.txid || (result as Record<string, unknown>)?.txHash || result;
        return data as T;
      },
      {
        context: context || `Contract invoke: ${operation}`,
        onError: (err) => {
          error.value = err;
          if (onError) {
            onError(err);
          }
        },
      }
    ).finally(() => {
      if (shouldSetLoading) {
        isLoading.value = false;
      }
    });
  };

  /**
   * Invoke a contract read operation
   */
  const read = async <T = unknown>(
    operation: string,
    args: ContractArg[] = [],
    options: InvokeOptions = {}
  ): Promise<ContractCallResult<T>> => {
    const { setLoading: shouldSetLoading = true, context, onError } = options;

    if (shouldSetLoading) {
      isLoading.value = true;
    }

    return handleAsync(
      async () => {
        const result = await invokeRead({
          scriptHash,
          operation,
          args,
        });

        return result as T;
      },
      {
        context: context || `Contract read: ${operation}`,
        onError: (err) => {
          error.value = err;
          if (onError) {
            onError(err);
          }
        },
      }
    ).finally(() => {
      if (shouldSetLoading) {
        isLoading.value = false;
      }
    });
  };

  return {
    /** Loading state */
    isLoading,
    /** Error from last operation */
    error,
    /** Invoke contract write operation */
    invoke,
    /** Invoke contract read operation */
    read,
  };
}
