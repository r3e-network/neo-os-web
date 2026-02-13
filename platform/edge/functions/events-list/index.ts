// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { queryEvents } from "../_shared/events.ts";

// Lists contract events for MiniApps with optional filtering and pagination.
// Supports polling via after_id parameter for real-time event monitoring.
export const handler = createHandler(
  { method: "GET", auth: "user", rateLimit: "events-list", scope: "events-list" },
  async ({ req, auth }) => {
    const url = new URL(req.url);
    const appId = url.searchParams.get("app_id") ?? undefined;
    const eventName = url.searchParams.get("event_name") ?? undefined;
    const contractAddress = url.searchParams.get("contract_address") ?? undefined;
    const chainId = url.searchParams.get("chain_id") ?? undefined;
    const limit = url.searchParams.get("limit") ?? undefined;
    const afterId = url.searchParams.get("after_id") ?? undefined;

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
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
