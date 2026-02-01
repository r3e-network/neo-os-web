// =============================================================================
// React Query Hooks - MiniApp Registry (developer submissions)
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import type { RegistryMiniApp } from "@/types";

async function fetchRegistryMiniApps(status?: string): Promise<RegistryMiniApp[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`/api/miniapps/registry${query}`, {
    headers: { ...getAdminAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error("Failed to load registry");
  }

  const data = await response.json();
  return data.apps || [];
}

export function useRegistryMiniApps(status?: string) {
  return useQuery({
    queryKey: ["miniapps-registry", status ?? "default"],
    queryFn: () => fetchRegistryMiniApps(status),
    staleTime: 60000,
  });
}

export function useApproveMiniAppVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appId,
      versionId,
      reviewNotes,
    }: {
      appId: string;
      versionId?: string;
      reviewNotes?: string;
    }) => {
      const response = await fetch("/api/miniapps/registry/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({ appId, versionId, reviewNotes }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve MiniApp");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps-registry"] });
    },
  });
}

export function useRejectMiniAppVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appId,
      versionId,
      reviewNotes,
    }: {
      appId: string;
      versionId?: string;
      reviewNotes?: string;
    }) => {
      const response = await fetch("/api/miniapps/registry/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({ appId, versionId, reviewNotes }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject MiniApp");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps-registry"] });
    },
  });
}
