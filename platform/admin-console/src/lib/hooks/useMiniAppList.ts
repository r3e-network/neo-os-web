// =============================================================================
// React Query Hooks - MiniApp List & CRUD
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS } from "@/lib/constants";
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update MiniApp status");
      }
      return payload;
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
      const action = typeof config.action === "string" ? config.action : "save_draft";
      const payload = {
        ...config,
        action,
      };
      const response = await fetch("/api/miniapps/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: (() => { try { return JSON.stringify(payload); } catch { throw new Error("Invalid form data"); } })(),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const err = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] create failed, could not parse error response:", e instanceof Error ? e.message : String(e)); return { error: { message: "Create failed" } }; });
        throw new Error(err?.error?.message || err?.error || "Failed to create MiniApp");
      }
      const data = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] create success but could not parse response JSON:", e instanceof Error ? e.message : String(e)); return null; }) as {
        action?: string;
      } & Record<string, unknown> | null;

      if (response.status === 202 && data?.action === "publish_requested") {
        return {
          ...(data || {}),
          publish_requested: true,
        };
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}

/**
 * Hook to delete a MiniApp
 */
export function useDeleteMiniApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appId: string) => {
      const response = await fetch("/api/miniapps/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({ appId, status: "disabled" }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const err = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] disable failed, could not parse error response:", e instanceof Error ? e.message : String(e)); return { error: { message: "Disable failed" } }; });
        throw new Error(err?.error?.message || err?.error || "Failed to disable MiniApp");
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
      const action = typeof config.action === "string" ? config.action : "save_draft";
      const payload = {
        ...config,
        app_id: appId,
        action,
      };
      const response = await fetch(`/api/miniapps/${encodeURIComponent(appId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: (() => { try { return JSON.stringify(payload); } catch { throw new Error("Invalid form data"); } })(),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const err = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] update failed, could not parse error response:", e instanceof Error ? e.message : String(e)); return { error: { message: "Update failed" } }; });
        throw new Error(err?.error?.message || err?.error || "Failed to update MiniApp");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}
