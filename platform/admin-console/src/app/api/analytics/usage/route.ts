import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/constants";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonError("Supabase service role not configured");
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
    const response = await fetch(`${SUPABASE_URL}/rest/v1/miniapp_usage?${params.toString()}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return jsonError(text || "Failed to fetch miniapp usage", response.status);
    }

    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return jsonError("Failed to connect to database", 502);
  }
}
