// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { queryTransactions } from "../_shared/events.ts";

// Lists chain transactions for MiniApps with optional filtering and pagination.
// Supports polling via after_id parameter for real-time transaction monitoring.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "transactions-list", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "transactions-list");
  if (scopeCheck) return scopeCheck;

  const url = new URL(req.url);
  const appId = url.searchParams.get("app_id") ?? undefined;
  const chainId = url.searchParams.get("chain_id") ?? undefined;
  const limit = url.searchParams.get("limit") ?? undefined;
  const afterId = url.searchParams.get("after_id") ?? undefined;

  try {
    const result = await queryTransactions(
      {
        app_id: appId,
        chain_id: chainId,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        after_id: afterId,
      },
      req
    );

    if (result instanceof Response) return result;
    return json(result, {}, req);
  } catch (err) {
    console.error("Transactions list error:", err);
    return errorResponse("SERVER_001", { message: (err as Error).message }, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
