// =============================================================================
// API Client - Base HTTP client with error handling
// =============================================================================

import type { APIError } from "@/types";
import { env } from "@/lib/env";
import { HEALTH_CHECK_TIMEOUT_MS } from "@/lib/constants";

const API_BASE_URL = env.NEXT_PUBLIC_EDGE_URL || "https://edge.localhost";
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Base fetch wrapper with error handling
 */
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      signal: options?.signal ?? AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error: APIError = {
        message: `HTTP ${response.status}: ${response.statusText}`,
        code: String(response.status),
      };

      try {
        const errorData = await response.json();
        error.message = errorData.message || error.message;
        error.details = errorData;
      } catch {
        // Response body is not JSON
      }

      throw error;
    }

    return await response.json();
  } catch (error) {
    if ((error as APIError).message) {
      throw error;
    }
    throw {
      message: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
    } as APIError;
  }
}

/**
 * Supabase REST API client
 */
export const supabaseClient = {
  async query<T>(table: string, params?: Record<string, string>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchJSON<T>(`${SUPABASE_URL}/rest/v1/${table}${queryString}`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
    });
  },

  async queryWithServiceRole<T>(table: string, params?: Record<string, string>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchJSON<T>(`${SUPABASE_URL}/rest/v1/${table}${queryString}`, {
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
    return fetchJSON<T>(`${API_BASE_URL}${path}`);
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    return fetchJSON<T>(`${API_BASE_URL}${path}`, {
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
