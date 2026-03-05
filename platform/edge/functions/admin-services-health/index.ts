import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireAdminRole } from "../_shared/supabase.ts";

const PLATFORM_SERVICES = [
  { name: "neofeeds", url: "http://neofeeds.service-layer.svc.cluster.local:8083" },
  { name: "neoflow", url: "http://neoflow.service-layer.svc.cluster.local:8084" },
  { name: "neoaccounts", url: "http://neoaccounts.service-layer.svc.cluster.local:8085" },
  { name: "neocompute", url: "http://neocompute.service-layer.svc.cluster.local:8086" },
  { name: "neovrf", url: "http://neovrf.service-layer.svc.cluster.local:8087" },
  { name: "neooracle", url: "http://neooracle.service-layer.svc.cluster.local:8088" },
  { name: "txproxy", url: "http://txproxy.service-layer.svc.cluster.local:8090" },
  { name: "neogasbank", url: "http://neogasbank.service-layer.svc.cluster.local:8091" },
  { name: "globalsigner", url: "http://globalsigner.service-layer.svc.cluster.local:8092" },
  { name: "neosimulation", url: "http://neosimulation.service-layer.svc.cluster.local:8093" },
  { name: "neorequests", url: "http://neorequests.service-layer.svc.cluster.local:8094" },
  { name: "edge-gateway", url: "http://edge-gateway.platform.svc.cluster.local:8787" },
];

const NEO_RPC_URL = Deno.env.get("NEO_RPC_URL") || "http://neo-express:50012";
const HEALTH_CHECK_TIMEOUT_MS = 5000;

async function checkNeoBlockchainHealth(): Promise<any> {
  const lastCheck = new Date().toISOString();
  try {
    const response = await fetch(NEO_RPC_URL, {
      method: "POST",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "getversion", params: [], id: 1 })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return {
      name: "neo-n3-blockchain",
      status: "healthy",
      url: NEO_RPC_URL,
      lastCheck,
      version: data.result.useragent || "unknown",
      uptime: "online"
    };
  } catch (err) {
    return {
      name: "neo-n3-blockchain",
      status: "unhealthy",
      url: NEO_RPC_URL,
      lastCheck,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

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

        const promises = PLATFORM_SERVICES.map((service) => checkServiceHealth(service.name, service.url));
        promises.push(checkNeoBlockchainHealth());
        
        const results = await Promise.allSettled(promises);
        
        const healthChecks = results.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            
            // Fallback for failed promises
            const isNeo = i === PLATFORM_SERVICES.length;
            return { 
                name: isNeo ? "neo-n3-blockchain" : PLATFORM_SERVICES[i].name, 
                status: "unhealthy", 
                url: isNeo ? NEO_RPC_URL : PLATFORM_SERVICES[i].url, 
                lastCheck: new Date().toISOString(), 
                error: r.reason?.message || "Health check failed" 
            };
        });

        return json(healthChecks, {}, req);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return error(500, `Failed to check services health: ${msg}`, "INTERNAL_ERROR", req);
    }
}

if (import.meta.main) {
    Deno.serve(handler);
}
