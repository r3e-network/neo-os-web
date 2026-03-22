import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";

/**
 * Data Binding Hook
 * Manages data fetching and binding for dynamic components
 */

export type DataSource = {
  type: "contract" | "api" | "static" | "websocket";
  endpoint?: string;
  method?: string;
  params?: Record<string, unknown>;
  pollInterval?: number;
  transform?: (data: unknown) => unknown;
};

export type DataBinding = {
  key: string;
  source: DataSource;
  defaultValue?: unknown;
};

type UseDataBindingOptions = {
  bindings: DataBinding[];
  enabled?: boolean;
  onError?: (error: Error, source: DataSource) => void;
};

type DataState = Record<string, unknown>;

export function useDataBinding({ bindings, enabled = true, onError }: UseDataBindingOptions) {
  const [data, setData] = useState<DataState>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, Error>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    if (!enabled || bindings.length === 0) return;

    if (mountedRef.current) setLoading(true);
    setErrors({});

    try {
      const results = await Promise.all(
        bindings.map(async (binding) => {
          try {
            let result: unknown;

            switch (binding.source.type) {
              case "static":
                result = binding.source.endpoint;
                break;

              case "api":
                result = await fetchApiData(binding.source, binding.key, abortControllers);
                break;

              case "contract":
                result = await fetchContractData(binding.source, binding.key);
                break;

              default:
                result = null;
            }

            const transformed = binding.source.transform ? binding.source.transform(result) : result;
            return { key: binding.key, value: transformed ?? binding.defaultValue };
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err, binding.source);
            return { key: binding.key, value: binding.defaultValue, error: err };
          }
        })
      );

      const newData: DataState = {};
      const newErrors: Record<string, Error> = {};

      results.forEach((r) => {
        if (r.error) {
          newErrors[r.key] = r.error;
        } else {
          newData[r.key] = r.value;
        }
      });

      if (mountedRef.current) {
        setData((prev) => ({ ...prev, ...newData }));
        setErrors(newErrors);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [bindings, enabled, onError]);

  // Clean up intervals when bindings or enabled change
  useEffect(() => {
    // Clear existing intervals first
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];

    // Abort any in-flight requests
    Object.values(abortControllers.current).forEach((ac) => ac.abort());
    abortControllers.current = {};

    if (!enabled || bindings.length === 0) return;

    fetchData();

    // Set up polling for sources with interval
    bindings.forEach((binding) => {
      if (binding.source.pollInterval && binding.source.pollInterval > 0) {
        const interval = setInterval(() => {
          fetchData();
        }, binding.source.pollInterval);
        intervalsRef.current.push(interval);
      }
    });

    return () => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      Object.values(abortControllers.current).forEach((ac) => ac.abort());
      abortControllers.current = {};
    };
  }, [bindings, enabled, fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const setValue = useCallback((key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    data,
    loading,
    errors,
    refetch,
    setValue,
  };
}

async function fetchApiData(
  source: DataSource,
  key: string,
  abortControllers: React.MutableRefObject<Record<string, AbortController>>
): Promise<unknown> {
  if (!source.endpoint) return null;

  const controller = new AbortController();
  abortControllers.current[key] = controller;

  const response = await fetch(source.endpoint, {
    method: source.method || "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: source.params
      ? (() => {
          try {
            return JSON.stringify(source.params);
          } catch (_e: unknown) {
            console.warn("[useDataBinding] JSON.stringify failed:", _e instanceof Error ? _e.message : String(_e));
            return undefined;
          }
        })()
      : undefined,
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function fetchContractData(source: DataSource, key: string): Promise<unknown> {
  // Contract data fetching for on-chain sources is not implemented in this hook yet.
  // This hook currently supports API/WebSocket data sources.
  return null;
}

/**
 * Subscribe to websocket data source
 */
export function useWebSocketSubscription(
  url: string,
  onMessage: (data: unknown) => void,
  enabled = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current(data);
      } catch {
        // Raw string fallback if JSON parse fails
        onMessageRef.current(event.data);
      }
    };

    ws.onerror = (error) => {
      logger.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, [url, enabled]);

  const send = useCallback((data: unknown) => {
    try {
      wsRef.current?.send(JSON.stringify(data));
    } catch (err) {
      console.warn("[useWebSocketSubscription] send failed:", err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { send };
}
