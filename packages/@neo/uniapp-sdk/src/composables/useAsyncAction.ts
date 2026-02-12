/**
 * useAsyncAction - Generic async action wrapper
 * Eliminates repeated loading/error state management pattern
 */
import { ref, type Ref } from "vue";
import { toError } from "../utils";

export interface AsyncActionState {
  isLoading: Ref<boolean>;
  error: Ref<Error | null>;
}

export interface AsyncActionResult<T, Args extends unknown[] = unknown[]> extends AsyncActionState {
  execute: (...args: Args) => Promise<T>;
}

/**
 * Creates a wrapped async action with loading and error state management
 * @param action - The async function to wrap
 * @returns Object with isLoading, error refs and execute function
 */
export function useAsyncAction<T, Args extends unknown[]>(
  action: (...args: Args) => Promise<T>
): AsyncActionResult<T, Args> {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const execute = async (...args: Args): Promise<T> => {
    isLoading.value = true;
    error.value = null;
    try {
      return await action(...args);
    } catch (e: unknown) {
      error.value = toError(e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  return { isLoading, error, execute };
}
