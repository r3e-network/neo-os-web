// =============================================================================
// API Route: Analytics Overview
// =============================================================================

import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET() {
  try {
    // Fetch total users
    const usersResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?select=count`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
    });

    const usersCount = parseInt(usersResponse.headers.get("content-range")?.split("/")[1] || "0");

    // Fetch total miniapps
    const miniappsResponse = await fetch(`${SUPABASE_URL}/rest/v1/miniapps?select=count`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
    });

    const miniappsCount = parseInt(miniappsResponse.headers.get("content-range")?.split("/")[1] || "0");

    // Fetch today's gas usage
    const today = new Date().toISOString().split("T")[0];
    const usageResponse = await fetch(`${SUPABASE_URL}/rest/v1/miniapp_usage?usage_date=eq.${today}&select=gas_used`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    const usageData: Array<{ gas_used?: number }> = await usageResponse.json();
    const gasUsageToday = usageData.reduce((sum: number, item) => sum + (item.gas_used || 0), 0);

    // Fetch usage by app (aggregated)
    const usageByAppResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_usage_by_app`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    let usageByApp = [];
    if (usageByAppResponse.ok) {
      usageByApp = await usageByAppResponse.json();
    }

    // Fetch total transactions from chain_txs table
    const txResponse = await fetch(`${SUPABASE_URL}/rest/v1/chain_txs?select=count`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
    });
    const totalTransactions = parseInt(txResponse.headers.get("content-range")?.split("/")[1] || "0");

    // Fetch usage over time (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const usageOverTimeResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/miniapp_usage?usage_date=gte.${sevenDaysAgo}&select=usage_date,gas_used&order=usage_date.asc`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    const usageOverTimeRaw: Array<{ usage_date: string; gas_used: number }> = usageOverTimeResponse.ok
      ? await usageOverTimeResponse.json()
      : [];

    // Aggregate usage by date
    const usageByDate = new Map<string, number>();
    for (const row of usageOverTimeRaw) {
      const date = row.usage_date;
      usageByDate.set(date, (usageByDate.get(date) || 0) + (row.gas_used || 0));
    }
    const usageOverTime = Array.from(usageByDate.entries()).map(([date, gas_used]) => ({ date, gas_used }));

    return NextResponse.json({
      totalUsers: usersCount,
      totalMiniApps: miniappsCount,
      totalTransactions,
      gasUsageToday,
      usageByApp,
      usageOverTime,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
