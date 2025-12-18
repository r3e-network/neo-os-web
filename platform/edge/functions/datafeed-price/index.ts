import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { getJSON } from "../_shared/tee.ts";

// Public read proxy to the TEE datafeed service (or a cache you add later).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  if (!symbol) return error(400, "symbol required", "SYMBOL_REQUIRED", req);

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
