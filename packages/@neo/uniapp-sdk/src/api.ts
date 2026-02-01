/**
 * Unified API fetch utility for SDK composables
 * Eliminates duplicate fetch/error handling patterns (DRY principle)
 */
import { API_BASE } from "./config";

export interface ApiError {
  message: string;
  code?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Calculates exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(2, attempt),
    config.maxDelayMs
  );
  // Add jitter (±25%)
  return delay * (0.75 + Math.random() * 0.5);
}

/**
 * Checks if an error is retryable
 */
function isRetryableError(error: unknown, statusCode?: number): boolean {
  if (statusCode && statusCode >= 500) return true;
  if (statusCode === 429) return true; // Rate limited
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('network') || msg.includes('timeout') || msg.includes('abort');
  }
  return false;
}

/**
 * Performs a fetch request with standardized error handling, retry logic, and cancellation support
 * Detects uni-app environment and uses uni.request if available
 */
export async function apiFetch<T>(
  endpoint: string, 
  options: RequestInit & { 
    retryConfig?: Partial<RetryConfig>;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // Check if request was cancelled
    if (options.signal?.aborted) {
      throw new Error("Request cancelled");
    }
    
    try {
      const result = await doFetch<T>(url, options);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if cancelled or not retryable
      if (options.signal?.aborted) throw lastError;
      if (attempt >= config.maxRetries) break;
      if (!isRetryableError(error)) break;
      
      // Wait before retry
      const delay = getRetryDelay(attempt, config);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error("Request failed");
}

async function doFetch<T>(url: string, options: RequestInit): Promise<T> {

  const normalizeHeaders = (headers?: HeadersInit): Record<string, string> | undefined => {
    if (!headers) return undefined;
    if (headers instanceof Headers) {
      const result: Record<string, string> = {};
      headers.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return headers as Record<string, string>;
  };

  // Detect uni-app environment
  // @ts-ignore - uni global
  if (typeof uni !== "undefined" && typeof uni.request === "function") {
    return new Promise((resolve, reject) => {
      const headers = normalizeHeaders(options.headers);
      const contentType = String(headers?.["Content-Type"] || headers?.["content-type"] || "");
      let data: unknown = options.body;
      if (typeof data === "string" && contentType.includes("application/json")) {
        try {
          data = JSON.parse(data);
        } catch {
          // Leave data as string if JSON parsing fails
        }
      }
      // @ts-ignore
      uni.request({
        url,
        method: options.method || "GET",
        data,
        header: headers,
        success: (res: import("./types").ApiResponse) => {
          if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
            resolve(res.data as T);
          } else {
            const msg = (res.data as any)?.error?.message || `Request failed: ${res.statusCode}`;
            reject(new Error(msg));
          }
        },
        fail: (err: import("./types").ApiError) => {
          reject(new Error(err.errMsg || "Network error"));
        },
      });
    });
  }

  // Fallback to fetch (H5 / Browser)
  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Request failed: ${url}`);
  }

  return res.json();
}

/**
 * GET request helper
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: "GET" });
}

/**
 * POST request helper
 */
export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
