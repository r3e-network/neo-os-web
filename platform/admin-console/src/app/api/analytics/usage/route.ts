import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { getSupabaseServiceEnv } from "@/lib/env";

function getConfiguredSupabase() {
  try {
    return getSupabaseServiceEnv({ strict: true });
  } catch (_e: unknown) {
    console.warn("[analytics/usage] getSupabaseServiceEnv failed:", _e instanceof Error ? _e.message : String(_e));
    return null;
  }
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const supabase = getConfiguredSupabase();
  if (!supabase) {
    return jsonError("Admin Supabase environment is not configured");
  }

  const url = new URL(req.url);
  const daysRaw = Number.parseInt(url.searchParams.get("days") || "30", 10);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(daysRaw, 365)) : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateISO = startDate.toISOString().split("T")[0];

  const params = new URLSearchParams({
    select: "*",
    usage_date: `gte.${startDateISO}`,
    order: "usage_date.desc",
  });

  try {
    const response = await fetch(`${supabase.url}/rest/v1/miniapp_usage?${params.toString()}`, {
      headers: {
        apikey: supabase.serviceRoleKey,
        Authorization: `Bearer ${supabase.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return jsonError("Failed to fetch miniapp usage", response.status);
    }

    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return jsonError("Failed to connect to database", 502);
  }
}
