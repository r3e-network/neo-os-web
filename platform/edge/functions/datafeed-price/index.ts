import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";

// Public read proxy to the TEE datafeed service (or a cache you add later).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  if (!symbol) return error(400, "symbol required", "SYMBOL_REQUIRED");

  const neofeedsURL = mustGetEnv("NEOFEEDS_URL").replace(/\\/$/, "");
  const upstream = await fetch(`${neofeedsURL}/price/${encodeURIComponent(symbol)}`);
  const text = await upstream.text();
  if (!upstream.ok) return error(upstream.status, text || "upstream error", "UPSTREAM_ERROR");

  try {
    return json(JSON.parse(text));
  } catch {
    return error(502, "invalid upstream JSON", "UPSTREAM_INVALID_JSON");
  }
});

