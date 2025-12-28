import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const usageByAppResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_usage_by_app`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!usageByAppResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch usage by app" }, { status: 500 });
    }

    const usageByApp = await usageByAppResponse.json();
    return NextResponse.json(usageByApp);
  } catch (error) {
    console.error("Usage by app error:", error);
    return NextResponse.json({ error: "Failed to fetch usage by app" }, { status: 500 });
  }
}
