import { handleCorsPreflight } from "../_shared/cors.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { error, json } from "../_shared/response.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, supabaseServiceClient } from "../_shared/supabase.ts";

type UsageRow = {
  app_id: string;
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

function normalizeUsageRow(row: Record<string, unknown>, fallback: { app_id: string; usage_date: string }): UsageRow {
  const appId = String(row.app_id ?? fallback.app_id ?? "").trim();
  const usageDate = String(row.usage_date ?? fallback.usage_date ?? "").trim();
  return {
    app_id: appId,
    usage_date: usageDate,
    gas_used: String(row.gas_used ?? "0"),
    governance_used: String(row.governance_used ?? "0"),
    tx_count: Number(row.tx_count ?? 0),
  };
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "miniapp-usage", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "miniapp-usage");
  if (scopeCheck) return scopeCheck;

  const url = new URL(req.url);
  const appId = String(url.searchParams.get("app_id") ?? "").trim();
  const date = resolveUsageDate(url.searchParams.get("date"));
  if (!date) return error(400, "date must be YYYY-MM-DD", "DATE_INVALID", req);

  let limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (Number.isNaN(limit) || limit <= 0) limit = 50;
  limit = Math.min(limit, 100);

  let supabase;
  try {
    supabase = supabaseServiceClient();
  } catch (err) {
    return error(500, String(err), "SUPABASE_CONFIG_ERROR", req);
  }

  if (appId) {
    const { data, error: err } = await supabase
      .from("miniapp_usage")
      .select("app_id, usage_date, gas_used, governance_used, tx_count")
      .eq("user_id", auth.userId)
      .eq("usage_date", date)
      .eq("app_id", appId)
      .maybeSingle();

    if (err) return error(500, err.message, "DB_ERROR", req);

    const usage = normalizeUsageRow(data ?? {}, { app_id: appId, usage_date: date });
    return json({ usage }, {}, req);
  }

  const { data, error: err } = await supabase
    .from("miniapp_usage")
    .select("app_id, usage_date, gas_used, governance_used, tx_count")
    .eq("user_id", auth.userId)
    .eq("usage_date", date)
    .order("gas_used", { ascending: false })
    .limit(limit);

  if (err) return error(500, err.message, "DB_ERROR", req);

  const usage = Array.isArray(data)
    ? data.map((row) => normalizeUsageRow(row as Record<string, unknown>, { app_id: "", usage_date: date }))
    : [];

  return json({ usage, date }, {}, req);
}

Deno.serve(handler);
