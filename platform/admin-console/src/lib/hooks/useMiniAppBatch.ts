// =============================================================================
// React Query Hooks - MiniApp Batch Import & Media Upload
// =============================================================================

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";

type MiniAppDefinitionImportSummary = {
  total: number;
  failed: number;
  validated: number;
  imported: number;
};

export type MiniAppDefinitionImportResult = {
  success: boolean;
  dry_run: boolean;
  definitions_dir: string;
  summary: MiniAppDefinitionImportSummary;
  results: Array<Record<string, unknown>>;
};

export type MiniAppBatchImportDefinitionInput = {
  file_name?: string;
  content?: string;
  payload?: Record<string, unknown>;
};

export type MiniAppBatchImportRollbackTarget = {
  app_id: string;
  mode: "create" | "update";
  rollback_version_id: string | null;
  rollback_release_channel: "draft" | "published" | null;
};

export type MiniAppBatchImportResult = {
  success: boolean;
  dry_run: boolean;
  stop_on_error: boolean;
  summary: {
    total: number;
    failed: number;
    validated: number;
    imported: number;
  };
  results: Array<Record<string, unknown>>;
  rollback_plan: {
    import_batch_id: string;
    generated_at: string;
    targets: MiniAppBatchImportRollbackTarget[];
  } | null;
};

export type MiniAppBatchRollbackResult = {
  success: boolean;
  summary: {
    total: number;
    failed: number;
    rolled_back: number;
    disabled_created_app: number;
    noop: number;
  };
  results: Array<Record<string, unknown>>;
};

export type MiniAppMediaAssetKind = "icon" | "logo" | "banner";

export type MiniAppMediaUploadVariant = {
  theme?: "light" | "dark" | "any";
  density?: "1x" | "2x" | "3x";
  locale?: string;
};

export type MediaUploadOptions = {
  variant?: MiniAppMediaUploadVariant;
  applyAsPrimary?: boolean;
};

export type MiniAppMediaUploadUrlResult = {
  success: boolean;
  upload_url: string;
  public_url: string;
  key: string;
  expires_in: number;
  headers?: Record<string, string>;
};

/**
 * Hook to import file-driven miniapp definitions
 */
export function useImportMiniAppDefinitions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dryRun,
    }: { dryRun?: boolean } = {}): Promise<MiniAppDefinitionImportResult> => {
      const response = await fetch("/api/miniapps/import-definitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify({ dry_run: Boolean(dryRun) }),
        signal: AbortSignal.timeout(10_000),
      });

      const payload = (await response.json().catch((e: unknown) => {
        console.warn(
          "[useMiniApps] failed to parse JSON response:",
          e instanceof Error ? e.message : String(e),
        );
        return null;
      })) as
        | ({
            error?: string;
          } & Partial<MiniAppDefinitionImportResult>)
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to import definition files");
      }

      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid import response");
      }

      return payload as MiniAppDefinitionImportResult;
    },
    onSuccess: (payload) => {
      if (!payload.dry_run) {
        queryClient.invalidateQueries({ queryKey: ["miniapps"] });
      }
    },
  });
}

/**
 * Hook to import miniapp definitions from uploaded JSON/YAML payloads
 */
export function useImportMiniAppBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      dry_run?: boolean;
      stop_on_error?: boolean;
      definitions: MiniAppBatchImportDefinitionInput[];
    }): Promise<MiniAppBatchImportResult> => {
      const response = await fetch("/api/miniapps/import-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });

      const payload = (await response.json().catch((e: unknown) => {
        console.warn(
          "[useMiniApps] failed to parse JSON response:",
          e instanceof Error ? e.message : String(e),
        );
        return null;
      })) as
        | ({
            error?: string;
          } & Partial<MiniAppBatchImportResult>)
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error || "Failed to import uploaded definitions",
        );
      }

      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid batch import response");
      }

      return payload as MiniAppBatchImportResult;
    },
    onSuccess: (payload) => {
      if (!payload.dry_run) {
        queryClient.invalidateQueries({ queryKey: ["miniapps"] });
      }
    },
  });
}

/**
 * Hook to rollback a previous miniapp batch import
 */
export function useRollbackMiniAppBatchImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      targets: MiniAppBatchImportRollbackTarget[];
    }): Promise<MiniAppBatchRollbackResult> => {
      const response = await fetch("/api/miniapps/import-batch/rollback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });

      const payload = (await response.json().catch((e: unknown) => {
        console.warn(
          "[useMiniApps] failed to parse JSON response:",
          e instanceof Error ? e.message : String(e),
        );
        return null;
      })) as
        | ({
            error?: string;
          } & Partial<MiniAppBatchRollbackResult>)
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to rollback import batch");
      }

      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid batch rollback response");
      }

      return payload as MiniAppBatchRollbackResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}

/**
 * Hook to create signed upload URLs for miniapp media assets (Cloudflare R2)
 */
export function useCreateMiniAppMediaUploadUrl() {
  return useMutation({
    mutationFn: async (input: {
      app_id: string;
      asset_type: MiniAppMediaAssetKind;
      content_type: string;
      file_name?: string;
      variant?: MiniAppMediaUploadVariant;
    }): Promise<MiniAppMediaUploadUrlResult> => {
      const response = await fetch("/api/miniapps/admin/media/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(20000),
      });

      const payload = (await response.json().catch((e: unknown) => {
        console.warn(
          "[useMiniApps] failed to parse JSON response:",
          e instanceof Error ? e.message : String(e),
        );
        return null;
      })) as
        | ({
            error?: string;
          } & Partial<MiniAppMediaUploadUrlResult>)
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create media upload URL");
      }

      if (!payload?.upload_url || !payload.public_url || !payload.key) {
        throw new Error("Invalid media upload URL response");
      }

      return payload as MiniAppMediaUploadUrlResult;
    },
  });
}
