import { useState, useEffect, useCallback, useRef } from "react";

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

  const fetchData = useCallback(async () => {
    if (!enabled || bindings.length === 0) return;

    setLoading(true);
    setErrors({});

    const results = await Promise.all(
      bindings.map(async (binding) => {
        try {
          let result: unknown;

          switch (binding.source.type) {
            case "static":
              result = binding.source.endpoint;
              break;

            case "api":
              result = await fetchApiData(binding.source, binding.key);
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

    setData((prev) => ({ ...prev, ...newData }));
    setErrors(newErrors);
    setLoading(false);
  }, [bindings, enabled, onError]);

  useEffect(() => {
    fetchData();

    // Set up polling for sources with interval
    const intervals: NodeJS.Timeout[] = [];
    bindings.forEach((binding) => {
      if (binding.source.pollInterval && binding.source.pollInterval > 0) {
        const interval = setInterval(() => {
          fetchData();
        }, binding.source.pollInterval);
        intervals.push(interval);
      }
    });

    return () => {
      intervals.forEach(clearInterval);
      Object.values(abortControllers.current).forEach((ac) => ac.abort());
    };
  }, [fetchData]);

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

async function fetchApiData(source: DataSource, key: string): Promise<unknown> {
  if (!source.endpoint) return null;

  const controller = new AbortController();

  const response = await fetch(source.endpoint, {
    method: source.method || "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: source.params ? JSON.stringify(source.params) : undefined,
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
  console.log("Fetching contract data:", source.endpoint);
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

  useEffect(() => {
    if (!enabled || !url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        onMessage(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, [url, enabled, onMessage]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { send };
}
