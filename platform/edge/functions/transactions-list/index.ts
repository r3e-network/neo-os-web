// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { queryTransactions } from "../_shared/events.ts";

// Lists chain transactions for MiniApps with optional filtering and pagination.
// Supports polling via after_id parameter for real-time transaction monitoring.
export const handler = createHandler(
  { method: "GET", auth: "user", rateLimit: "transactions-list", scope: "transactions-list" },
  async ({ req, auth }) => {
    const url = new URL(req.url);
    const appId = url.searchParams.get("app_id") ?? undefined;
    const chainId = url.searchParams.get("chain_id") ?? undefined;
    const limit = url.searchParams.get("limit") ?? undefined;
    const afterId = url.searchParams.get("after_id") ?? undefined;

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
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
