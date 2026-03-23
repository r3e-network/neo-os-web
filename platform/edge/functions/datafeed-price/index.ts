import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { getJSON } from "../_shared/tee.ts";
import { resolveDatafeedPriceUpstream } from "../_shared/morpheus.ts";

// Public read proxy to the TEE datafeed service (or a cache you add later).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return error(400, "invalid request url", "INVALID_URL", req);
  }
  const rawSymbol = (url.searchParams.get("symbol") ?? "").trim();
  if (!rawSymbol) return error(400, "symbol required", "SYMBOL_REQUIRED", req);
  const normalizedSymbol = rawSymbol.toUpperCase();
  const symbol = /[-/_]/.test(normalizedSymbol) ? normalizedSymbol : `${normalizedSymbol}-USD`;

  const rl = await requireRateLimit(req, "datafeed-price");
  if (rl) return rl;

  let upstream: { url: string; authToken?: string };
  try {
    upstream = resolveDatafeedPriceUpstream(symbol);
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "upstream misconfigured", "UPSTREAM_ERROR", req);
  }
  const result = await getJSON(
    upstream.url,
    {
      ...(upstream.authToken ? { Authorization: `Bearer ${upstream.authToken}` } : {}),
      ...(upstream.authToken ? { "x-phala-token": upstream.authToken } : {}),
    },
    req,
  );
  if (result instanceof Response) return result;
  return json(result, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
