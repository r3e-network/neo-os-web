import { handleCorsPreflight } from "../_shared/cors.ts";
import { getEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireAdminRole } from "../_shared/supabase.ts";

type ServiceEntry = { name: string; url: string };

const NEO_RPC_URL = Deno.env.get("NEO_RPC_URL") || "http://neo-express:50012";
const HEALTH_CHECK_TIMEOUT_MS = 5000;

function buildPlatformServices(): ServiceEntry[] {
  const entries: Array<ServiceEntry | null> = [
    { name: "morpheus-runtime", url: getEnv("MORPHEUS_RUNTIME_URL") || getEnv("PHALA_API_URL") || "" },
    { name: "morpheus-public-api", url: getEnv("MORPHEUS_PUBLIC_API_URL") || getEnv("NEXT_PUBLIC_MORPHEUS_PUBLIC_API_URL") || "" },
    { name: "morpheus-control-plane", url: getEnv("MORPHEUS_CONTROL_PLANE_URL") || "" },
    { name: "morpheus-edge", url: getEnv("MORPHEUS_EDGE_URL") || "" },
    { name: "morpheus-datafeed", url: getEnv("NEOFEEDS_URL") || getEnv("NEOFEEDS_SERVICE_URL") || "" },
    { name: "morpheus-automation", url: getEnv("NEOFLOW_URL") || getEnv("NEOFLOW_SERVICE_URL") || "" },
    { name: "morpheus-compute", url: getEnv("NEOCOMPUTE_URL") || getEnv("NEOCOMPUTE_SERVICE_URL") || "" },
    { name: "morpheus-vrf", url: getEnv("NEOVRF_URL") || getEnv("NEOVRF_SERVICE_URL") || "" },
    { name: "morpheus-oracle", url: getEnv("NEOORACLE_URL") || getEnv("NEOORACLE_SERVICE_URL") || "" },
    { name: "txproxy", url: getEnv("TXPROXY_URL") || getEnv("TXPROXY_SERVICE_URL") || "" },
    { name: "gasbank", url: getEnv("GASBANK_URL") || getEnv("GASBANK_SERVICE_URL") || "" },
    { name: "globalsigner", url: getEnv("GLOBALSIGNER_SERVICE_URL") || "" },
    { name: "neoaccounts", url: getEnv("NEOACCOUNTS_SERVICE_URL") || "" },
    { name: "aa-relay", url: getEnv("AA_RELAY_URL") || getEnv("NEXT_PUBLIC_AA_RELAY_URL") || "" },
    { name: "morpheus-paymaster", url: getEnv("MORPHEUS_PAYMASTER_ENDPOINT") || getEnv("AA_PAYMASTER_ENDPOINT") || "" },
    { name: "edge-gateway", url: getEnv("NEXT_PUBLIC_EDGE_URL") || getEnv("EDGE_BASE_URL") || "" },
  ];

  return entries.filter((entry): entry is ServiceEntry => Boolean(entry && entry.url));
}

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
    console.error("[admin-services-health] neo-n3-blockchain health check failed:", err instanceof Error ? err.message : String(err));
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
    console.error(`[admin-services-health] ${name} health check failed:`, err instanceof Error ? err.message : String(err));
    return {
      name,
      status: "unhealthy",
      url,
      lastCheck,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function handler(req: Request): Promise<Response> {
    const corsResponse = handleCorsPreflight(req);
    if (corsResponse) return corsResponse;

    try {
        const adminAuth = await requireAdminRole(req);
        if (adminAuth.error) return adminAuth.error;

        if (req.method !== "GET") {
            return error(405, "Method not allowed", "METHOD_NOT_ALLOWED", req);
        }

        const services = buildPlatformServices();
        const promises = services.map((service) => checkServiceHealth(service.name, service.url));
        promises.push(checkNeoBlockchainHealth());
        
        const results = await Promise.allSettled(promises);
        
        const healthChecks = results.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            
            // Fallback for failed promises
            const isNeo = i === services.length;
            return { 
                name: isNeo ? "neo-n3-blockchain" : services[i].name, 
                status: "unhealthy", 
                url: isNeo ? NEO_RPC_URL : services[i].url, 
                lastCheck: new Date().toISOString(), 
                error: r instanceof Error ? r.message : (r?.reason?.message || "Health check failed") 
            };
        });

        return json(healthChecks, {}, req);
    } catch (err: unknown) {
        // Log internal error for debugging, don't expose details to client
        console.error("[admin-services-health]", err instanceof Error ? err.message : String(err));
        return error(500, "Failed to check services health", "INTERNAL_ERROR", req);
    }
}

if (import.meta.main) {
    Deno.serve(handler);
}
