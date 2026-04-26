// =============================================================================
// API Route: Services Health Check
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getEnv } from "@/lib/env";
import type { ServiceHealth, ServiceStatus } from "@/types";

const SERVICE_FALLBACKS = [
  { name: "MiniApp Host", url: "/api/miniapps" },
  { name: "Edge Gateway", url: "admin-services-health" },
  { name: "Supabase", url: "rest/v1" },
  { name: "Admin Console", url: "/api/services/health" },
] as const;

function normalizeStatus(status: unknown): ServiceStatus {
  return status === "healthy" || status === "unhealthy" || status === "unknown"
    ? status
    : "unknown";
}

function normalizeHealthChecks(
  payload: unknown,
  checkedAt: string,
): ServiceHealth[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item, index) => ({
      name:
        typeof item.name === "string" && item.name.trim()
          ? item.name
          : `Service ${index + 1}`,
      status: normalizeStatus(item.status),
      url: typeof item.url === "string" ? item.url : "",
      lastCheck:
        typeof item.lastCheck === "string" && item.lastCheck
          ? item.lastCheck
          : checkedAt,
      version: typeof item.version === "string" ? item.version : undefined,
      uptime: typeof item.uptime === "number" ? item.uptime : undefined,
      error: typeof item.error === "string" ? item.error : undefined,
    }));
}

function fallbackHealthChecks(
  error: unknown,
  checkedAt: string,
): ServiceHealth[] {
  const message =
    error instanceof Error
      ? error.message
      : String(error || "Health service unavailable");

  return SERVICE_FALLBACKS.map((service) => ({
    name: service.name,
    status: "unknown",
    url: service.url,
    lastCheck: checkedAt,
    error: `Health service unavailable: ${message}`,
  }));
}

function filterForRequestedService(req: Request, checks: ServiceHealth[]) {
  const serviceName = new URL(req.url).searchParams.get("service");
  if (!serviceName) return checks;

  const normalizedName = serviceName.toLowerCase();
  return (
    checks.find((service) => service.name.toLowerCase() === normalizedName) || {
      name: serviceName,
      status: "unknown" as const,
      url: "",
      lastCheck: new Date().toISOString(),
      error: "Service is not registered in the health inventory.",
    }
  );
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const checkedAt = new Date().toISOString();

  try {
    const env = getEnv({
      strict: true,
      required: ["SUPABASE_SERVICE_ROLE_KEY"],
    });
    const edgeURL =
      env.NEXT_PUBLIC_EDGE_URL ||
      "http://edge-gateway.platform.svc.cluster.local:8787";

    const response = await fetch(`${edgeURL}/admin-services-health`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const healthChecks = normalizeHealthChecks(
      await response.json(),
      checkedAt,
    );
    return NextResponse.json(filterForRequestedService(req, healthChecks), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      filterForRequestedService(req, fallbackHealthChecks(error, checkedAt)),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
