// =============================================================================
// React Query Hooks - MiniApps
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import type { MiniApp } from "@/types";

/**
 * Fetch all MiniApps
 */
async function fetchMiniApps(): Promise<MiniApp[]> {
  const response = await fetch("/api/miniapps", {
    headers: getAdminAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch miniapps: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch single MiniApp by ID
 */
async function fetchMiniApp(appId: string): Promise<MiniApp> {
  const response = await fetch(`/api/miniapps/${encodeURIComponent(appId)}`, {
    headers: getAdminAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch miniapp ${appId}: ${response.status}`);
  }
  const payload = (await response.json()) as MiniApp | MiniApp[] | null;
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (!result) {
    throw new Error(`MiniApp ${appId} not found`);
  }
  return result;
}

/**
 * Hook to fetch all MiniApps
 */
export function useMiniApps() {
  return useQuery({
    queryKey: ["miniapps"],
    queryFn: fetchMiniApps,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/**
 * Hook to fetch single MiniApp
 */
export function useMiniApp(appId: string) {
  return useQuery({
    queryKey: ["miniapps", appId],
    queryFn: () => fetchMiniApp(appId),
    enabled: !!appId,
    staleTime: DEFAULT_STALE_TIME_MS,
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
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error("Failed to update MiniApp status");
      }

      const data = await response.json();
      if (data?.requires_onchain_confirmation && typeof window !== "undefined") {
        const payload = JSON.stringify(data.invocation, null, 2);
        try {
          if (typeof window.alert === "function") {
            window.alert(
              `Status change requires on-chain confirmation.\n\n` +
              `Submit this invocation to AppRegistry and wait for StatusChanged sync:\n\n${payload}`,
            );
          }
        } catch {
          logger.warn("Unable to display status-change alert; invocation:", payload);
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}

/**
 * Hook to create a new MiniApp
 */
export function useCreateMiniApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const response = await fetch("/api/miniapps/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Create failed" }));
        throw new Error(err.error || "Failed to create MiniApp");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}

/**
 * Hook to update a MiniApp config
 */
export function useUpdateMiniApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appId, config }: { appId: string; config: Record<string, unknown> }) => {
      const response = await fetch(`/api/miniapps/${encodeURIComponent(appId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        throw new Error("Failed to update MiniApp");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}
