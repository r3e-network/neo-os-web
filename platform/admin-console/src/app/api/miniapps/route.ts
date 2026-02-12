// =============================================================================
// API Route: MiniApps
// Server-side proxy to Supabase for miniapp data
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
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20")));
  const offset = (page - 1) * pageSize;
  const appId = url.searchParams.get("app_id");

  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(pageSize),
    offset: String(offset),
  });

  if (appId) {
    params.set("app_id", `eq.${appId}`);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/miniapps?${params.toString()}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Failed to fetch miniapps", detail }, { status: response.status });
    }

    const miniapps = await response.json();
    const total = parseInt(response.headers.get("content-range")?.split("/")[1] || "0");

    return NextResponse.json({ miniapps, total, page, pageSize });
  } catch (error) {
    console.error("MiniApps API error:", error);
    return NextResponse.json({ error: "Failed to fetch miniapps" }, { status: 500 });
  }
}
