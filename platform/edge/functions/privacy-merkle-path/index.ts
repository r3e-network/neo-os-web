import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";

export async function handler(req: Request): Promise<Response> {
    const preflight = handleCorsPreflight(req);
    if (preflight) return preflight;
    if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

    const rl = await requireRateLimit(req, "privacy-merkle", undefined);
    if (rl) return rl;

    const url = new URL(req.url);
    const commitment = url.searchParams.get("commitment");
    if (!commitment) return error(400, "commitment required", "COMMITMENT_REQUIRED", req);

    const neoprivacyUrl = (Deno.env.get("NEOPRIVACY_URL") || "http://localhost:8088").replace(/\/$/, "");
    try {
        const backendRes = await fetch(`${neoprivacyUrl}/api/v1/privacy/merkle-path/${encodeURIComponent(commitment)}`);
        if (!backendRes.ok) {
            const txt = await backendRes.text().catch(() => "unknown error");
            return error(backendRes.status, txt, "BACKEND_ERROR", req);
        }
        const data = await backendRes.json();
        return json(data, {}, req);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return error(500, `failed to fetch merkle path: ${msg}`, "INTERNAL_ERROR", req);
    }
}

if (import.meta.main) {
    Deno.serve(handler);
}
