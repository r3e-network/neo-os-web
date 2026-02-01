import { useState, useCallback } from "react";
import type { AsyncState, LoadingState as _LoadingState } from "@/types";

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    status: "idle",
  });

  const execute = useCallback(async (promise: Promise<T>) => {
    setState({ data: null, loading: true, error: null, status: "loading" });
    try {
      const data = await promise;
      setState({ data, loading: false, error: null, status: "success" });
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState({ data: null, loading: false, error: err, status: "error" });
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, status: "idle" });
  }, []);

  return { ...state, execute, reset };
}
