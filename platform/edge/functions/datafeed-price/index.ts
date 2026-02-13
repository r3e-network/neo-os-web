// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { validationError } from "../_shared/error-codes.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { getJSON } from "../_shared/tee.ts";

// Public read proxy to the TEE datafeed service (or a cache you add later).
export const handler = createHandler(
  { method: "GET", auth: false, rateLimit: "datafeed-price" },
  async ({ req, url }) => {
    const rawSymbol = (url.searchParams.get("symbol") ?? "").trim();
    if (!rawSymbol) return validationError("symbol", "symbol required", req);
    const normalizedSymbol = rawSymbol.toUpperCase();
    const symbol = /[-/_]/.test(normalizedSymbol) ? normalizedSymbol : `${normalizedSymbol}-USD`;

    const neofeedsURL = mustGetEnv("NEOFEEDS_URL").replace(/\/$/, "");
    const result = await getJSON(`${neofeedsURL}/price/${encodeURIComponent(symbol)}`, {}, req);
    if (result instanceof Response) return result;
    return json(result, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
