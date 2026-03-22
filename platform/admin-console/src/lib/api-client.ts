// =============================================================================
// API Client - Base HTTP client with error handling
// =============================================================================

import type { APIError } from "@/types";
import { getEnv } from "@/lib/env";
import { HEALTH_CHECK_TIMEOUT_MS } from "@/lib/constants";

function getAPIBaseURL() {
  return getEnv({ required: [] }).NEXT_PUBLIC_EDGE_URL || "https://edge.localhost";
}

function getSupabaseURL(required: boolean) {
  const env = getEnv({
    strict: required,
    required: required ? ["NEXT_PUBLIC_SUPABASE_URL"] : [],
  });
  return env.NEXT_PUBLIC_SUPABASE_URL || "";
}

/**
 * Base fetch wrapper with error handling
 */
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    signal: options?.signal ?? AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let details: unknown = null;
    let message = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const payload = await response.json();
      details = payload;
      if (payload && typeof payload === "object") {
        const maybeMessage =
          typeof (payload as { message?: unknown }).message === "string"
            ? String((payload as { message?: unknown }).message)
            : typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
              ? String((payload as { error?: { message?: unknown } }).error?.message)
              : "";
        if (maybeMessage) message = maybeMessage;
      }
    } catch {
      // response is not JSON; keep default message
    }

    const error = Object.assign(new Error(message), {
      code: String(response.status),
      details,
    }) as Error & APIError;

    throw error;
  }

  return await response.json();
}

/**
 * Supabase REST API client
 */
export const supabaseClient = {
  async query<T>(table: string, params?: Record<string, string>): Promise<T> {
    const env = getEnv();
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchJSON<T>(`${getSupabaseURL(false)}/rest/v1/${table}${queryString}`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
    });
  },

  async queryWithServiceRole<T>(table: string, params?: Record<string, string>): Promise<T> {
    const env = getEnv({ strict: true, required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] });
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchJSON<T>(`${getSupabaseURL(true)}/rest/v1/${table}${queryString}`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
  },
};

/**
 * Edge Gateway API client
 */
export const edgeClient = {
  async get<T>(path: string): Promise<T> {
    return fetchJSON<T>(`${getAPIBaseURL()}${path}`);
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    return fetchJSON<T>(`${getAPIBaseURL()}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

/**
 * Internal services health check
 */
export async function checkServiceHealth(serviceName: string, serviceUrl: string) {
  try {
    const response = await fetch(`${serviceUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        status: "unhealthy" as const,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      status: "healthy" as const,
      data,
    };
  } catch (error) {
    return {
      status: "unhealthy" as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
