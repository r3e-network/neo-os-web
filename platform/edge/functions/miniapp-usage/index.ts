// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { createHandler } from "../_shared/handler.ts";

type UsageRow = {
  app_id: string;
  chain_id?: string;
  usage_date: string;
  gas_used: string;
  governance_used: string;
  tx_count: number;
};

function resolveUsageDate(raw?: string | null): string | null {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeUsageRow(
  row: Record<string, unknown>,
  fallback: { app_id: string; chain_id?: string; usage_date: string }
): UsageRow {
  const appId = String(row.app_id ?? fallback.app_id ?? "").trim();
  const chainId = String(row.chain_id ?? fallback.chain_id ?? "").trim();
  const usageDate = String(row.usage_date ?? fallback.usage_date ?? "").trim();
  return {
    app_id: appId,
    chain_id: chainId || undefined,
    usage_date: usageDate,
    gas_used: String(row.gas_used ?? "0"),
    governance_used: String(row.governance_used ?? "0"),
    tx_count: Number(row.tx_count ?? 0),
  };
}

export const handler = createHandler(
  { method: "GET", rateLimit: "miniapp-usage", scope: "miniapp-usage" },
  async ({ req, auth, url }) => {
    const appId = String(url.searchParams.get("app_id") ?? "").trim();
    const chainId = String(url.searchParams.get("chain_id") ?? "").trim();
    const date = resolveUsageDate(url.searchParams.get("date"));
    if (!date) return validationError("date", "date must be YYYY-MM-DD", req);

    let limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 50;
    limit = Math.min(limit, 100);

    let supabase;
    try {
      supabase = supabaseServiceClient();
    } catch (err) {
      return errorResponse("SERVER_001", { message: String(err) }, req);
    }

    if (appId) {
      let query = supabase
        .from("miniapp_usage")
        .select("app_id, chain_id, usage_date, gas_used, governance_used, tx_count")
        .eq("user_id", auth.userId)
        .eq("usage_date", date)
        .eq("app_id", appId);

      if (chainId) {
        query = query.eq("chain_id", chainId);
      }

      const { data, error: err } = await query.maybeSingle();

      if (err) return errorResponse("SERVER_002", { message: err.message }, req);

      const usage = normalizeUsageRow(data ?? {}, { app_id: appId, chain_id: chainId, usage_date: date });
      return json({ usage }, {}, req);
    }

    let query = supabase
      .from("miniapp_usage")
      .select("app_id, chain_id, usage_date, gas_used, governance_used, tx_count")
      .eq("user_id", auth.userId)
      .eq("usage_date", date);

    if (chainId) {
      query = query.eq("chain_id", chainId);
    }

    const { data, error: err } = await query.order("gas_used", { ascending: false }).limit(limit);

    if (err) return errorResponse("SERVER_002", { message: err.message }, req);

    const usage = Array.isArray(data)
      ? data.map((row) =>
          normalizeUsageRow(row as Record<string, unknown>, { app_id: "", chain_id: chainId, usage_date: date })
        )
      : [];

    return json({ usage, date }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
