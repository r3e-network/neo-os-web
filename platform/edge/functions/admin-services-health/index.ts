import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireAdminRole } from "../_shared/supabase.ts";

const PLATFORM_SERVICES = [
  { name: "neofeeds", url: "http://neofeeds.service-layer.svc.cluster.local:8080" },
  { name: "neoaccounts", url: "http://neoaccounts.service-layer.svc.cluster.local:8085" },
  { name: "confcompute", url: "http://confcompute.service-layer.svc.cluster.local:8081" },
  { name: "conforacle", url: "http://conforacle.service-layer.svc.cluster.local:8082" },
  { name: "datafeed", url: "http://datafeed.service-layer.svc.cluster.local:8083" },
  { name: "vrf", url: "http://vrf.service-layer.svc.cluster.local:8084" },
  { name: "automation", url: "http://automation.service-layer.svc.cluster.local:8086" },
  { name: "gasbank", url: "http://gasbank.service-layer.svc.cluster.local:8087" },
  { name: "edge-gateway", url: "http://edge-gateway.platform.svc.cluster.local:8787" },
];

const HEALTH_CHECK_TIMEOUT_MS = 5000;

async function checkServiceHealth(name: string, url: string) {
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
    return {
      name,
      status: "healthy",
      url,
      lastCheck,
      version: data.version || "unknown",
      uptime: data.uptime || "unknown",
    };
  } catch (err) {
    return {
      name,
      status: "unhealthy",
      url,
      lastCheck,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function handler(req: Request): Promise<Response> {
    const corsResponse = handleCorsPreflight(req);
    if (corsResponse) return corsResponse;

    try {
        const { error: authErr } = await requireAdminRole(req);
        if (authErr) return error(403, "Admin role required", "FORBIDDEN", req);

        if (req.method !== "GET") {
            return error(405, "Method not allowed", "METHOD_NOT_ALLOWED", req);
        }

        const results = await Promise.allSettled(PLATFORM_SERVICES.map((service) => checkServiceHealth(service.name, service.url)));
        const healthChecks = results.map((r, i) =>
            r.status === "fulfilled"
                ? r.value
                : { 
                    name: PLATFORM_SERVICES[i].name, 
                    status: "unhealthy", 
                    url: PLATFORM_SERVICES[i].url, 
                    lastCheck: new Date().toISOString(), 
                    error: r.reason?.message || "Health check failed" 
                },
        );

        return json(healthChecks, {}, req);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return error(500, `Failed to check services health: ${msg}`, "INTERNAL_ERROR", req);
    }
}

if (import.meta.main) {
    Deno.serve(handler);
}
