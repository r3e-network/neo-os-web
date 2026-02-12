// =============================================================================
// React Query Hooks - MiniApps
// Queries go through server-side API routes (not direct Supabase client)
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import type { MiniApp } from "@/types";

type MiniAppsResponse = {
  miniapps: MiniApp[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Fetch MiniApps via server-side API route
 */
async function fetchMiniApps(page: number, pageSize: number): Promise<MiniAppsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(`/api/miniapps?${params.toString()}`, {
    headers: getAdminAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch MiniApps");
  }
  return response.json();
}

/**
 * Hook to fetch all MiniApps with pagination
 */
export function useMiniApps(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ["miniapps", page, pageSize],
    queryFn: () => fetchMiniApps(page, pageSize),
    staleTime: 60000,
    select: (data) => data,
  });
}

/**
 * Hook to fetch single MiniApp
 */
export function useMiniApp(appId: string) {
  return useQuery({
    queryKey: ["miniapps", appId],
    queryFn: async () => {
      const params = new URLSearchParams({ app_id: appId, pageSize: "1" });
      const response = await fetch(`/api/miniapps?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch MiniApp ${appId}`);
      }
      const data: MiniAppsResponse = await response.json();
      if (!data.miniapps.length) {
        throw new Error(`MiniApp ${appId} not found`);
      }
      return data.miniapps[0];
    },
    enabled: !!appId,
    staleTime: 60000,
  });
}

/**
 * Hook to update MiniApp status
 */
export function useUpdateMiniAppStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: "active" | "disabled" }) => {
      const response = await fetch("/api/miniapps/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({ appId, status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update MiniApp status");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}
