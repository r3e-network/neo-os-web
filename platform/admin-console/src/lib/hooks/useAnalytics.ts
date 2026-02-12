// =============================================================================
// React Query Hooks - Analytics
// All queries go through server-side API routes
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import type { AnalyticsData, MiniAppUsage } from "@/types";

/**
 * Fetch analytics overview data via server-side API route
 */
async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch("/api/analytics", { headers: getAdminAuthHeaders() });
  if (!response.ok) {
    throw new Error("Failed to fetch analytics");
  }
  return response.json();
}

/**
 * Fetch MiniApp usage data via server-side API route
 */
async function fetchMiniAppUsage(days = 30): Promise<MiniAppUsage[]> {
  const response = await fetch(`/api/analytics/usage?days=${days}`, {
    headers: getAdminAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch usage data");
  }
  return response.json();
}

/**
 * Hook to fetch analytics overview
 */
export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    staleTime: 60000,
  });
}

/**
 * Hook to fetch MiniApp usage data
 */
export function useMiniAppUsage(days = 30) {
  return useQuery({
    queryKey: ["analytics", "usage", days],
    queryFn: () => fetchMiniAppUsage(days),
    staleTime: 60000,
  });
}

/**
 * Hook to fetch usage by app
 */
export function useUsageByApp() {
  return useQuery({
    queryKey: ["analytics", "by-app"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/by-app", { headers: getAdminAuthHeaders() });
      if (!response.ok) {
        throw new Error("Failed to fetch usage by app");
      }
      return response.json();
    },
    staleTime: 60000,
  });
}
