// =============================================================================
// API Route: MiniApp Usage
// Server-side proxy to Supabase for usage data
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30")));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const params = new URLSearchParams({
    select: "*",
    usage_date: `gte.${startDate.toISOString().split("T")[0]}`,
    order: "usage_date.desc",
  });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/miniapp_usage?${params.toString()}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Failed to fetch usage data", detail }, { status: response.status });
    }

    const usage = await response.json();
    return NextResponse.json(usage);
  } catch (error) {
    console.error("Usage API error:", error);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
