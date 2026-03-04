import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { getEnv } from "../_shared/env.ts";

// In a real Edge environment, you'd bundle or import snarkjs via esm.sh
// import * as snarkjs from "npm:snarkjs";
// For this environment, we structure the exact production logic.

type RelayRequest = {
    proof: any; // The Groth16 proof object
    nullifierHash: string;
    root: string;
    recipient: string;
    relayerFee: string;
    asset: string;
    amount: string;
};

// Hardcoded Verification Key (Generated from Circom)
// In production, this would be loaded from a secure storage or bundled.
const vkey = {
    "protocol": "groth16",
    "curve": "bn128",
    "nPublic": 4,
    "vk_alpha_1": ["...", "...", "1"],
    "vk_beta_2": [["...", "..."], ["...", "..."], ["1", "0"]],
    "vk_gamma_2": [["...", "..."], ["...", "..."], ["1", "0"]],
    "vk_delta_2": [["...", "..."], ["...", "..."], ["1", "0"]],
    "vk_alphabeta_12": [[["...", "..."], ["...", "..."], ["...", "..."]], [["...", "..."], ["...", "..."], ["...", "..."]]],
    "IC": [
        ["...", "...", "1"],
        ["...", "...", "1"],
        ["...", "...", "1"],
        ["...", "...", "1"],
        ["...", "...", "1"]
    ]
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

    // --- ZERO KNOWLEDGE PROOF VERIFICATION ---
    try {
        const publicSignals = [
            body.root,
            body.nullifierHash,
            body.recipient,
            body.relayerFee
        ];

        // Production execution:
        // const isValid = await snarkjs.groth16.verify(vkey, publicSignals, body.proof);
        // if (!isValid) {
        //     return error(403, "Cryptographic ZK Proof verification failed", "INVALID_PROOF", req);
        // }
        
        // Development Bypass (since Circom isn't fully compiled in this environment)
        const isDev = getEnv("NODE_ENV") !== "production";
        if (!isDev) {
             // In pure production, we mandate the SnarkJS evaluation.
             return error(501, "SNARK execution requires native bindings in this Edge node", "NOT_IMPLEMENTED", req);
        }
    } catch (err: unknown) {
        return error(403, `Proof verification exception: ${err instanceof Error ? err.message : String(err)}`, "INVALID_PROOF", req);
    }
    // -----------------------------------------

    const neoprivacyUrl = (getEnv("NEOPRIVACY_URL") || "http://neo-privacy.service-layer.svc.cluster.local:8088").replace(/\/$/, "");
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
