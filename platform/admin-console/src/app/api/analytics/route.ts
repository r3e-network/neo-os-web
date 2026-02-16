// =============================================================================
// API Route: Analytics Overview
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "@/lib/constants";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const fetchTimeout = 10000;
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const countHeaders = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
    };
    const defaultHeaders = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    };

    // Parallelize all independent Supabase requests
    const [usersResponse, miniappsResponse, usageResponse, usageByAppResponse, txResponse, usageOverTimeResponse] =
      await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/users?select=count`, {
          headers: countHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${SUPABASE_URL}/rest/v1/miniapps?select=count`, {
          headers: countHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${SUPABASE_URL}/rest/v1/miniapp_usage?usage_date=eq.${today}&select=gas_used`, {
          headers: defaultHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${SUPABASE_URL}/rest/v1/rpc/get_usage_by_app`, {
          method: "POST",
          headers: {
            ...defaultHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${SUPABASE_URL}/rest/v1/chain_txs?select=count`, {
          headers: countHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(
          `${SUPABASE_URL}/rest/v1/miniapp_usage?usage_date=gte.${sevenDaysAgo}&select=usage_date,gas_used&order=usage_date.asc`,
          {
            headers: defaultHeaders,
            signal: AbortSignal.timeout(fetchTimeout),
          },
        ),
      ]);

    // Parse count from content-range header
    const parseCount = (response: Response) => {
      const range = response.headers.get("content-range");
      return range && range.includes("/")
        ? Number.parseInt(range.split("/")[1] ?? "0", 10) || 0
        : 0;
    };

    const usersCount = parseCount(usersResponse);
    const miniappsCount = parseCount(miniappsResponse);
    const totalTransactions = parseCount(txResponse);

    const usageRaw = await usageResponse.json();
    const usageData: Array<{ gas_used?: number }> = Array.isArray(usageRaw) ? usageRaw : [];
    const gasUsageToday = usageData.reduce((sum: number, item) => sum + (item.gas_used || 0), 0);

    let usageByApp = [];
    if (usageByAppResponse.ok) {
      usageByApp = await usageByAppResponse.json();
    }

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
    logger.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
