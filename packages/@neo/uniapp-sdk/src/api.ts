/**
 * Unified API fetch utility for SDK composables
 * Eliminates duplicate fetch/error handling patterns (DRY principle)
 */
import { API_BASE } from "./config";

export interface ApiError {
  message: string;
  code?: string;
}

/**
 * Performs a fetch request with standardized error handling
 * Detects uni-app environment and uses uni.request if available
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

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
        success: (res: any) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data as T);
          } else {
            const msg = res.data?.error?.message || `Request failed: ${res.statusCode}`;
            reject(new Error(msg));
          }
        },
        fail: (err: any) => {
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
    throw new Error(err.error?.message || `Request failed: ${endpoint}`);
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
