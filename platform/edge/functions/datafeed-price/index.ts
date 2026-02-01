// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { getJSON } from "../_shared/tee.ts";

// Public read proxy to the TEE datafeed service (or a cache you add later).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const url = new URL(req.url);
  const rawSymbol = (url.searchParams.get("symbol") ?? "").trim();
  if (!rawSymbol) return validationError("symbol", "symbol required", req);
  const normalizedSymbol = rawSymbol.toUpperCase();
  const symbol = /[-/_]/.test(normalizedSymbol) ? normalizedSymbol : `${normalizedSymbol}-USD`;

  const rl = await requireRateLimit(req, "datafeed-price");
  if (rl) return rl;

  const neofeedsURL = mustGetEnv("NEOFEEDS_URL").replace(/\/$/, "");
  const result = await getJSON(`${neofeedsURL}/price/${encodeURIComponent(symbol)}`, {}, req);
  if (result instanceof Response) return result;
  return json(result, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
