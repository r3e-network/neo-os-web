/**
 * Health Check Endpoint
 *
 * Provides system health status and environment validation.
 * This endpoint is designed for monitoring systems and load balancers.
 */

// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { getEnvSummary } from "../_shared/env-validation.ts";
import { getChainConfig } from "../_shared/chains.ts";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    environment: {
      valid: boolean;
      error_count: number;
      warning_count: number;
      errors: string[];
      warnings: string[];
    };
    chains: {
      total: number;
      configured: number;
    };
  };
  uptime_seconds: number;
}

const START_TIME = Date.now();
const VERSION = Deno.env.get("SERVICE_VERSION") || "dev";

/**
 * Test connectivity to a service
 */
async function testService(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "health-check" },
    });

    clearTimeout(timeoutId);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Calculate overall health status
 */
function calculateStatus(envValid: boolean, envErrors: number): "healthy" | "degraded" | "unhealthy" {
  if (!envValid || envErrors > 0) {
    return "unhealthy";
  }
  return "healthy";
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return error(405, "Method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const url = new URL(req.url);
  const detailed = url.searchParams.get("detailed") === "true";

  try {
    // Get environment validation summary
    const envSummary = getEnvSummary();

    // Count configured chains
    const chainIds = url.searchParams.get("chains")?.split(",") || [];
    let configuredChains = 0;

    if (chainIds.length > 0) {
      for (const chainId of chainIds) {
        if (getChainConfig(chainId)) {
          configuredChains++;
        }
      }
    }

    // Determine overall status
    const status = calculateStatus(envSummary.valid, envSummary.error_count);

    // Build health response
    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: VERSION,
      environment: Deno.env.get("DENO_ENV") || "unknown",
      checks: {
        environment: envSummary,
        chains: {
          total: chainIds.length > 0 ? chainIds.length : 0,
          configured: configuredChains,
        },
      },
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    };

    // Return appropriate HTTP status based on health
    const httpStatus =
      status === "healthy"
        ? 200
        : status === "degraded"
          ? 200 // Degraded still returns 200
          : 503; // Unhealthy returns 503

    return json(health, { status: httpStatus }, req);
  } catch (err) {
    // If health check itself fails, return 503
    const errorHealth: HealthStatus = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      version: VERSION,
      environment: Deno.env.get("DENO_ENV") || "unknown",
      checks: {
        environment: {
          valid: false,
          error_count: 1,
          warning_count: 0,
          errors: ["Health check failed"],
          warnings: [],
        },
        chains: {
          total: 0,
          configured: 0,
        },
      },
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    };

    return json(errorHealth, { status: 503 }, req);
  }
}

/**
 * Simple liveness probe - returns 200 if service is running
 */
export async function livenessHandler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  return json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
    },
    {},
    req
  );
}

/**
 * Readiness probe - checks if service can handle requests
 */
export async function readinessHandler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const envSummary = getEnvSummary();
  const ready = envSummary.valid && envSummary.error_count === 0;

  return json(
    {
      ready,
      timestamp: new Date().toISOString(),
      checks: {
        environment: envSummary.valid,
      },
    },
    { status: ready ? 200 : 503 },
    req
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
