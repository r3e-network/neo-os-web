import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { requireAdminRole } from "../_shared/supabase.ts";
import { getEnv } from "../_shared/env.ts";

const SIMULATION_URL = getEnv("NEOSIMULATION_URL") || "http://neosimulation:8093";

export async function handler(req: Request): Promise<Response> {
    const corsResponse = handleCorsPreflight(req);
    if (corsResponse) return corsResponse;

    try {
        const adminAuth = await requireAdminRole(req);
        if (adminAuth.error) return adminAuth.error;

        if (req.method === "GET") {
            const url = new URL(req.url);
            // Example: ?action=status
            const action = url.searchParams.get("action") || "status";
            if (action !== "status") {
                return error(400, "Invalid action for GET", "BAD_REQUEST", req);
            }

            const res = await fetch(`${SIMULATION_URL}/status`, {
                signal: AbortSignal.timeout(5000),
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) {
                return error(res.status, `HTTP ${res.status}`, "UPSTREAM_ERROR", req);
            }

            const data = await res.json();
            return json(data, {}, req);
        }

        if (req.method === "POST") {
            const body = await readJsonBody(req);
            if (!body) return error(400, "Missing JSON body", "BAD_REQUEST", req);

            const { action, config } = body as { action?: string; config?: unknown };
            if (action !== "start" && action !== "stop") {
                return error(400, "Invalid action", "BAD_REQUEST", req);
            }

            const res = await fetch(`${SIMULATION_URL}/${action}`, {
                method: "POST",
                signal: AbortSignal.timeout(10000),
                headers: { "Content-Type": "application/json" },
                body: config ? (() => { try { return JSON.stringify(config); } catch (_e: unknown) { console.warn("[admin-simulations] JSON.stringify config failed:", _e instanceof Error ? _e.message : String(_e)); return "{}"; } })() : undefined,
            });

            if (!res.ok) {
                return error(res.status, `Simulation ${action} failed`, "UPSTREAM_ERROR", req);
            }

            return json({ success: true }, {}, req);
        }

        return error(405, "Method not allowed", "METHOD_NOT_ALLOWED", req);
    } catch (err: unknown) {
        // Log internal error for debugging, don't expose details to client
        console.error("[admin-simulations]", err instanceof Error ? err.message : String(err));
        return error(500, "Failed to handle simulation request", "INTERNAL_ERROR", req);
    }
}

if (import.meta.main) {
    Deno.serve(handler);
}
