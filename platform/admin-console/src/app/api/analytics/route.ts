// =============================================================================
// API Route: Analytics Overview
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { getSupabaseServiceEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { usageRowSchema, usageByAppRowSchema, usageOverTimeRowSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  let supabase: ReturnType<typeof getSupabaseServiceEnv>;
  try {
    supabase = getSupabaseServiceEnv({ strict: true });
  } catch (error) {
    logger.error("Analytics environment error:", error instanceof Error ? error.message : "unknown error");
    return jsonError("Admin Supabase environment is not configured");
  }

  try {
    const fetchTimeout = 10000;
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const countHeaders = {
      apikey: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      Prefer: "count=exact",
    };
    const defaultHeaders = {
      apikey: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
    };

    // Parallelize all independent Supabase requests
    const [usersResponse, miniappsResponse, usageResponse, usageByAppResponse, txResponse, usageOverTimeResponse] =
      await Promise.all([
        fetch(`${supabase.url}/rest/v1/users?select=count`, {
          headers: countHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${supabase.url}/rest/v1/miniapps?select=count`, {
          headers: countHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${supabase.url}/rest/v1/miniapp_usage?usage_date=eq.${today}&select=gas_used`, {
          headers: defaultHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${supabase.url}/rest/v1/rpc/get_usage_by_app`, {
          method: "POST",
          headers: {
            ...defaultHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(`${supabase.url}/rest/v1/chain_txs?select=count`, {
          headers: countHeaders,
          signal: AbortSignal.timeout(fetchTimeout),
        }),
        fetch(
          `${supabase.url}/rest/v1/miniapp_usage?usage_date=gte.${sevenDaysAgo}&select=usage_date,gas_used&order=usage_date.asc&limit=10000`,
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
    const usageData = z.array(usageRowSchema).catch([]).parse(usageRaw);
    const gasUsageToday = usageData.reduce((sum: number, item) => sum + (item.gas_used || 0), 0);

    let usageByApp: z.infer<typeof usageByAppRowSchema>[] = [];
    if (usageByAppResponse.ok) {
      usageByApp = z.array(usageByAppRowSchema).catch([]).parse(await usageByAppResponse.json());
    }

    const usageOverTimeRaw = usageOverTimeResponse.ok
      ? z.array(usageOverTimeRowSchema).catch([]).parse(await usageOverTimeResponse.json())
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
    logger.error("Analytics error:", error instanceof Error ? error.message : "unknown error");
    return jsonError("Failed to fetch analytics");
  }
}
