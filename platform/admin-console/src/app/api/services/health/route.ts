// =============================================================================
// API Route: Services Health Check
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { PLATFORM_SERVICES, HEALTH_CHECK_TIMEOUT_MS } from "@/lib/constants";
import { healthResponseSchema } from "@/lib/schemas";
import type { ServiceHealth } from "@/types";

async function checkServiceHealth(name: string, url: string): Promise<ServiceHealth> {
  const lastCheck = new Date().toISOString();

  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return {
        name,
        status: "unhealthy",
        url,
        lastCheck,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const parsed = healthResponseSchema.catch({}).parse(data);

    return {
      name,
      status: "healthy",
      url,
      lastCheck,
      version: parsed.version,
      uptime: parsed.uptime,
    };
  } catch (error) {
    return {
      name,
      status: "unhealthy",
      url,
      lastCheck,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const results = await Promise.allSettled(PLATFORM_SERVICES.map((service) => checkServiceHealth(service.name, service.url)));
    const healthChecks = results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { name: PLATFORM_SERVICES[i].name, status: "unhealthy" as const, url: PLATFORM_SERVICES[i].url, lastCheck: new Date().toISOString(), error: r.reason?.message || "Health check failed" },
    );

    return NextResponse.json(healthChecks);
  } catch (error) {
    return NextResponse.json({ error: "Failed to check services health" }, { status: 500 });
  }
}
