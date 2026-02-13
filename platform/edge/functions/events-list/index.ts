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
import { queryEvents } from "../_shared/events.ts";

// Lists contract events for MiniApps with optional filtering and pagination.
// Supports polling via after_id parameter for real-time event monitoring.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "events-list", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "events-list");
  if (scopeCheck) return scopeCheck;

  const url = new URL(req.url);
  const appId = url.searchParams.get("app_id") ?? undefined;
  const eventName = url.searchParams.get("event_name") ?? undefined;
  const contractAddress = url.searchParams.get("contract_address") ?? undefined;
  const chainId = url.searchParams.get("chain_id") ?? undefined;
  const limit = url.searchParams.get("limit") ?? undefined;
  const afterId = url.searchParams.get("after_id") ?? undefined;

  try {
    const result = await queryEvents(
      {
        app_id: appId,
        event_name: eventName,
        contract_address: contractAddress,
        chain_id: chainId,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        after_id: afterId,
      },
      req
    );

    if (result instanceof Response) return result;
    return json(result, {}, req);
  } catch (err) {
    console.error("Events list error:", err);
    return errorResponse("SERVER_001", { message: (err as Error).message }, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
