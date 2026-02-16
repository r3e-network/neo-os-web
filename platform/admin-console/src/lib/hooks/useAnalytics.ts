// =============================================================================
// React Query Hooks - Analytics
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/api-client";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS } from "@/lib/constants";
import type { AnalyticsData, MiniAppUsage } from "@/types";

/**
 * Fetch analytics overview data
 */
async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch("/api/analytics", { headers: getAdminAuthHeaders(), signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch analytics: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch MiniApp usage data
 */
async function fetchMiniAppUsage(days = 30): Promise<MiniAppUsage[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return supabaseClient.query<MiniAppUsage[]>("miniapp_usage", {
    select: "*",
    usage_date: `gte.${startDate.toISOString().split("T")[0]}`,
    order: "usage_date.desc",
  });
}

/**
 * Hook to fetch analytics overview
 */
export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/**
 * Hook to fetch MiniApp usage data
 */
export function useMiniAppUsage(days = 30) {
  return useQuery({
    queryKey: ["analytics", "usage", days],
    queryFn: () => fetchMiniAppUsage(days),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/**
 * Hook to fetch usage by app
 */
export function useUsageByApp() {
  return useQuery({
    queryKey: ["analytics", "by-app"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/by-app", { headers: getAdminAuthHeaders(), signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        throw new Error("Failed to fetch usage by app");
      }
      return response.json();
    },
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}
