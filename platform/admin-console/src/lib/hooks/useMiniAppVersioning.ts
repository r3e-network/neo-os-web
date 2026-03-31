// =============================================================================
// React Query Hooks - MiniApp Versioning & Rollback
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS } from "@/lib/constants";
import type { MiniApp } from "@/types";

export type MiniAppVersionSummary = {
  id: string;
  app_id: string;
  version_no: number;
  release_channel: "draft" | "published";
  source_action: "save_draft" | "publish" | "disable" | "rollback";
  status: "active" | "pending" | "disabled";
  manifest_hash: string;
  actor: string;
  note?: string | null;
  created_at: string;
  manifest?: Record<string, unknown>;
  row_snapshot?: Record<string, unknown>;
};

export type MiniAppVersionListResult = {
  app_id: string;
  release_channel: "all" | "draft" | "published";
  releases: {
    draft?: string | null;
    published?: string | null;
  };
  versions: MiniAppVersionSummary[];
};

export type MiniAppRollbackResult = {
  success: boolean;
  app: MiniApp;
  rollback: {
    target_version_id: string;
    target_version_no: number;
    new_version_id: string;
    new_version_no: number;
    release_channel: "draft" | "published";
  };
};

/**
 * Hook to fetch version history for a MiniApp
 */
export function useMiniAppVersions(
  appId: string,
  options: {
    releaseChannel?: "all" | "draft" | "published";
    enabled?: boolean;
  } = {},
) {
  const { releaseChannel = "all", enabled = true } = options;

  return useQuery({
    queryKey: ["miniapps", "versions", appId, releaseChannel],
    enabled: Boolean(appId) && enabled,
    staleTime: DEFAULT_STALE_TIME_MS,
    queryFn: async (): Promise<MiniAppVersionListResult> => {
      const params = new URLSearchParams({ app_id: appId });
      if (releaseChannel !== "all") {
        params.set("release_channel", releaseChannel);
      }

      const response = await fetch(`/api/miniapps/versions?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
        signal: AbortSignal.timeout(15000),
      });

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
        error?: string;
      } & Partial<MiniAppVersionListResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to fetch miniapp versions");
      }

      if (!payload || !Array.isArray(payload.versions)) {
        throw new Error("Invalid miniapp versions response");
      }

      return payload as MiniAppVersionListResult;
    },
  });
}

/**
 * Hook to rollback miniapp to a previous version
 */
export function useRollbackMiniAppVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: {
        appId: string;
        versionId?: string;
        versionNo?: number;
        releaseChannel?: "draft" | "published";
      },
    ): Promise<MiniAppRollbackResult> => {
      const response = await fetch("/api/miniapps/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({
          app_id: params.appId,
          version_id: params.versionId,
          version_no: params.versionNo,
          release_channel: params.releaseChannel || "published",
        }),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
        error?: string;
      } & Partial<MiniAppRollbackResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to rollback miniapp version");
      }

      if (!payload || !payload.success || !payload.app || !payload.rollback) {
        throw new Error("Invalid rollback response");
      }

      return payload as MiniAppRollbackResult;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
      queryClient.invalidateQueries({ queryKey: ["miniapps", payload.app.app_id] });
      queryClient.invalidateQueries({ queryKey: ["miniapps", "versions", payload.app.app_id] });
    },
  });
}
