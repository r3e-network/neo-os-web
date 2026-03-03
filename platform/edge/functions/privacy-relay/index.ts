import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireAuth } from "../_shared/supabase.ts";

type RelayRequest = {
    proof: string;
    nullifierHash: string;
    root: string;
    recipient: string;
    relayerFee: string;
    asset: string;
    amount: string;
};

export async function handler(req: Request): Promise<Response> {
    const preflight = handleCorsPreflight(req);
    if (preflight) return preflight;
    if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    const rl = await requireRateLimit(req, "privacy-relay", auth);
    if (rl) return rl;

    const bodyOrErr = await readJsonBody<RelayRequest>(req);
    if (bodyOrErr instanceof Response) return bodyOrErr;
    const body = bodyOrErr;

    if (!body.proof || !body.nullifierHash || !body.recipient) {
        return error(400, "proof, nullifierHash and recipient required", "BAD_REQUEST", req);
    }

    const neoprivacyUrl = (Deno.env.get("NEOPRIVACY_URL") || "http://localhost:8088").replace(/\/$/, "");
    try {
        const backendRes = await fetch(`${neoprivacyUrl}/api/v1/privacy/relay`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`
            },
            body: JSON.stringify(body)
        });

        if (!backendRes.ok) {
            const txt = await backendRes.text().catch(() => "unknown error");
            return error(backendRes.status, txt, "BACKEND_ERROR", req);
        }
        const data = await backendRes.json();
        return json(data, {}, req);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return error(500, `failed to relay privacy tx: ${msg}`, "INTERNAL_ERROR", req);
    }
}

if (import.meta.main) {
    Deno.serve(handler);
}
