/**
 * Async Operation Composable
 *
 * Standardizes async operations with loading state,
 * error handling, and timeout support.
 *
 * @example
 * ```ts
 * const { execute, isLoading, error, reset } = useAsyncOperation();
 *
 * const result = await execute(
 *   async () => await someAsyncTask(),
 *   {
 *     context: "Data fetch",
 *     timeoutMs: 5000,
 *     onSuccess: (data) => console.log(data)
 *   }
 * );
 * ```
 */

import { ref } from "vue";
import { handleAsync, withTimeout } from "@shared/utils/errorHandling";
import type { AsyncOperationOptions, AsyncOperationResult } from "@neo/types";

/**
 * Extended async operation options for Vue composable
 */
export interface VueAsyncOperationOptions extends Omit<AsyncOperationOptions, "onSuccess"> {
  /** Success callback with data */
  onSuccess?: (data: unknown) => void;
}

export function useAsyncOperation() {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  /**
   * Execute an async operation with standard error handling
   */
  const execute = async <T = unknown>(
    operation: () => Promise<T>,
    options: VueAsyncOperationOptions = {}
  ): Promise<AsyncOperationResult<T>> => {
    const { context = "Async operation", timeoutMs, onError, onSuccess, setLoading = true, rethrow = false } = options;

    if (setLoading) {
      isLoading.value = true;
    }
    error.value = null;

    const op = timeoutMs ? () => withTimeout(operation(), timeoutMs, context) : operation;

    try {
      const result = (await handleAsync(op, {
        context,
        onError: (err) => {
          error.value = err;
          if (onError) {
            onError(err);
          }
        },
        rethrow,
      })) as AsyncOperationResult<T>;

      if (result.success && onSuccess) {
        onSuccess(result.data);
      }

      return result;
    } finally {
      if (setLoading) {
        isLoading.value = false;
      }
    }
  };

  /**
   * Reset error state
   */
  const reset = () => {
    error.value = null;
  };

  return {
    /** Loading state */
    isLoading,
    /** Error from last operation */
    error,
    /** Execute an async operation */
    execute,
    /** Reset error state */
    reset,
  };
}
