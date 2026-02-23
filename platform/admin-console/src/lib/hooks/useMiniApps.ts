// =============================================================================
// React Query Hooks - MiniApps
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS } from "@/lib/constants";
import type { MiniApp } from "@/types";

type MiniAppDefinitionImportSummary = {
  total: number;
  failed: number;
  validated: number;
  imported: number;
};

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

export type MiniAppPublishRequest = {
  id: string;
  app_id: string;
  requested_version_id: string | null;
  requested_version_no: number | null;
  requested_manifest_hash: string;
  requested_by: string;
  request_note: string | null;
  status: "pending" | "approved" | "rejected" | "applied" | "cancelled";
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_version_id: string | null;
  applied_at: string | null;
  requested_at: string;
  updated_at: string;
  timing?: {
    ageMinutes: number;
    slaMinutes: number;
    escalationMinutes: number;
    isSlaBreached: boolean;
    isEscalated: boolean;
  };
};

export type MiniAppPublishRequestListResult = {
  requests: MiniAppPublishRequest[];
  status: "all" | "pending" | "approved" | "rejected" | "applied" | "cancelled";
  sla?: {
    minutes: number;
    escalation_minutes: number;
    pending: number;
    sla_breached: number;
    escalated: number;
  };
};

export type MiniAppPublishReminderResult = {
  success: boolean;
  sent: number;
  dry_run: boolean;
  channel: "webhook" | "disabled";
  reminders: Array<{
    request_id: string;
    app_id: string;
    status: "sla_breach" | "escalated";
    age_minutes: number;
    message: string;
  }>;
};

export type MiniAppPublishAuditVerifyResult = {
  ok: boolean;
  scanned: number;
  requests: number;
  total_events: number;
  invalid_hash_events: number;
  chain_break_events: number;
  table_missing: boolean;
  generated_at: string;
  issues: Array<{
    request_id: string;
    id: string;
    type: "prev_hash_mismatch" | "chain_hash_mismatch";
    expected_prev_hash?: string | null;
    actual_prev_hash?: string | null;
    expected_chain_hash?: string;
    actual_chain_hash?: string;
  }>;
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

export type MiniAppMediaUploadUrlResult = {
  success: boolean;
  upload_url: string;
  public_url: string;
  key: string;
  expires_in: number;
  headers?: Record<string, string>;
};

export type TemplateKind = "frontend" | "contract";
export type TemplateSourceType = "builtin" | "community" | "verified";
export type TemplatePublishRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type TemplateCatalogItem = {
  row_id: string;
  template_kind: TemplateKind;
  template_id: string;
  version: string;
  owner_user_id: string | null;
  name: string;
  description: string;
  category: string;
  source_type: TemplateSourceType;
  tags: string[];
  is_active: boolean;
  is_verified: boolean;
  usage_count: number;
  rating_avg: number | null;
  rating_count: number;
  schema: Record<string, unknown>;
  ui_schema: Record<string, unknown>;
  manifest: Record<string, unknown>;
  factory_template_ref: string | null;
  updated_at: string;
};

export type TemplatePublishRequestRow = {
  id: string;
  template_kind: TemplateKind;
  template_row_id: string;
  status: TemplatePublishRequestStatus;
  requested_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type TemplateMarketTemplateListResult = {
  mode: "templates";
  templates: TemplateCatalogItem[];
  approval_required?: boolean;
};

export type TemplateMarketRequestListResult = {
  mode: "requests";
  requests: TemplatePublishRequestRow[];
};

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

      const payload = await response.json().catch(() => null) as {
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
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: "Create failed" } }));
        throw new Error(err?.error?.message || err?.error || "Failed to create MiniApp");
      }
      const data = await response.json().catch(() => null) as {
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
        const err = await response.json().catch(() => ({ error: { message: "Disable failed" } }));
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
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: "Update failed" } }));
        throw new Error(err?.error?.message || err?.error || "Failed to update MiniApp");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
    },
  });
}

/**
 * Hook to import file-driven miniapp definitions
 */
export function useImportMiniAppDefinitions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dryRun }: { dryRun?: boolean } = {}): Promise<MiniAppDefinitionImportResult> => {
      const response = await fetch("/api/miniapps/import-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({ dry_run: Boolean(dryRun) }),
        signal: AbortSignal.timeout(30000),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } & Partial<MiniAppDefinitionImportResult> | null;

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
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(60000),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } & Partial<MiniAppBatchImportResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to import uploaded definitions");
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
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(60000),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } & Partial<MiniAppBatchRollbackResult> | null;

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
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(20000),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } & Partial<MiniAppMediaUploadUrlResult> | null;

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

      const payload = await response.json().catch(() => null) as {
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

      const payload = await response.json().catch(() => null) as {
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

/**
 * Hook to list publish requests
 */
export function useMiniAppPublishRequests(
  options: {
    appId?: string;
    status?: "all" | "pending" | "approved" | "rejected" | "applied" | "cancelled";
    enabled?: boolean;
  } = {},
) {
  const { appId, status = "all", enabled = true } = options;

  return useQuery({
    queryKey: ["miniapps", "publish-requests", appId || "all", status],
    enabled,
    staleTime: DEFAULT_STALE_TIME_MS,
    queryFn: async (): Promise<MiniAppPublishRequestListResult> => {
      const params = new URLSearchParams();
      if (appId) params.set("app_id", appId);
      if (status !== "all") params.set("status", status);

      const response = await fetch(`/api/miniapps/publish-requests?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
        signal: AbortSignal.timeout(15000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
      } & Partial<MiniAppPublishRequestListResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to fetch publish requests");
      }

      if (!payload || !Array.isArray(payload.requests)) {
        throw new Error("Invalid publish request response");
      }

      return payload as MiniAppPublishRequestListResult;
    },
  });
}

/**
 * Hook to review publish requests (approve/reject/cancel)
 */
export function useReviewMiniAppPublishRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      decision: "approve" | "reject" | "cancel";
      reviewNote?: string;
      appId?: string;
    }) => {
      const response = await fetch("/api/miniapps/publish-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({
          request_id: params.requestId,
          decision: params.decision,
          review_note: params.reviewNote,
        }),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to review publish request");
      }

      return payload;
    },
    onSuccess: (_payload, variables) => {
      queryClient.invalidateQueries({ queryKey: ["miniapps"] });
      queryClient.invalidateQueries({ queryKey: ["miniapps", "publish-requests"] });
      if (variables?.appId) {
        queryClient.invalidateQueries({ queryKey: ["miniapps", "publish-requests", variables.appId] });
      }
    },
  });
}

/**
 * Hook to trigger publish request SLA reminders
 */
export function useTriggerPublishReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { dryRun?: boolean } = {}): Promise<MiniAppPublishReminderResult> => {
      const response = await fetch("/api/miniapps/publish-requests/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({ dry_run: Boolean(params.dryRun) }),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
      } & Partial<MiniAppPublishReminderResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to trigger publish reminders");
      }

      if (!payload || !Array.isArray(payload.reminders)) {
        throw new Error("Invalid reminder response");
      }

      return payload as MiniAppPublishReminderResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps", "publish-requests"] });
    },
  });
}

/**
 * Hook to verify publish approval audit chain
 */
export function useVerifyPublishAuditChain() {
  return useMutation({
    mutationFn: async (params: {
      appId?: string;
      requestId?: string;
      limit?: number;
    } = {}): Promise<MiniAppPublishAuditVerifyResult> => {
      const query = new URLSearchParams();
      if (params.appId) query.set("app_id", params.appId);
      if (params.requestId) query.set("request_id", params.requestId);
      if (typeof params.limit === "number" && params.limit > 0) query.set("limit", String(params.limit));

      const response = await fetch(`/api/miniapps/publish-requests/verify-audit?${query.toString()}`, {
        headers: getAdminAuthHeaders(),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
      } & Partial<MiniAppPublishAuditVerifyResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to verify publish audit chain");
      }

      if (!payload || typeof payload.ok !== "boolean" || !Array.isArray(payload.issues)) {
        throw new Error("Invalid publish audit verify response");
      }

      return payload as MiniAppPublishAuditVerifyResult;
    },
  });
}

export function useTemplateMarketTemplates(
  options: {
    kind?: TemplateKind | "all";
    category?: string;
    source?: TemplateSourceType | "all";
    active?: "true" | "false" | "all";
    verified?: "true" | "false" | "all";
    search?: string;
    limit?: number;
    enabled?: boolean;
  } = {},
) {
  const {
    kind = "all",
    category,
    source = "all",
    active = "all",
    verified = "all",
    search,
    limit = 100,
    enabled = true,
  } = options;

  return useQuery({
    queryKey: ["miniapps", "template-market", "templates", kind, category || "", source, active, verified, search || "", limit],
    enabled,
    staleTime: DEFAULT_STALE_TIME_MS,
    queryFn: async (): Promise<TemplateMarketTemplateListResult> => {
      const params = new URLSearchParams();
      params.set("mode", "templates");
      if (kind !== "all") params.set("kind", kind);
      if (category) params.set("category", category);
      if (source !== "all") params.set("source", source);
      if (active !== "all") params.set("active", active);
      if (verified !== "all") params.set("verified", verified);
      if (search) params.set("search", search);
      params.set("limit", String(limit));

      const response = await fetch(`/api/miniapps/template-market?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
      } & Partial<TemplateMarketTemplateListResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load template market templates");
      }

      if (!payload || payload.mode !== "templates" || !Array.isArray(payload.templates)) {
        throw new Error("Invalid template market templates response");
      }

      return payload as TemplateMarketTemplateListResult;
    },
  });
}

export function useTemplateMarketRequests(
  options: {
    kind?: TemplateKind | "all";
    status?: TemplatePublishRequestStatus | "all";
    limit?: number;
    enabled?: boolean;
  } = {},
) {
  const { kind = "all", status = "all", limit = 100, enabled = true } = options;

  return useQuery({
    queryKey: ["miniapps", "template-market", "requests", kind, status, limit],
    enabled,
    staleTime: DEFAULT_STALE_TIME_MS,
    queryFn: async (): Promise<TemplateMarketRequestListResult> => {
      const params = new URLSearchParams();
      params.set("mode", "requests");
      if (kind !== "all") params.set("kind", kind);
      if (status !== "all") params.set("status", status);
      params.set("limit", String(limit));

      const response = await fetch(`/api/miniapps/template-market?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
      } & Partial<TemplateMarketRequestListResult> | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load template publish requests");
      }

      if (!payload || payload.mode !== "requests" || !Array.isArray(payload.requests)) {
        throw new Error("Invalid template publish request response");
      }

      return payload as TemplateMarketRequestListResult;
    },
  });
}

export function useUpsertTemplateMarketEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      kind: TemplateKind;
      template_id: string;
      version?: string;
      name?: string;
      description?: string;
      category?: string;
      schema?: Record<string, unknown>;
      ui_schema?: Record<string, unknown>;
      manifest: Record<string, unknown>;
      source_type?: TemplateSourceType;
      tags?: string[];
      is_active?: boolean;
      is_verified?: boolean;
      owner_user_id?: string | null;
      factory_template_ref?: string | null;
    }) => {
      const response = await fetch("/api/miniapps/template-market", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({
          action: "upsert_template",
          ...input,
        }),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
        template?: TemplateCatalogItem;
        request?: TemplatePublishRequestRow;
        approval_required?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to upsert template");
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps", "template-market"] });
    },
  });
}

export function useReviewTemplateMarketRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      decision: "approve" | "reject" | "cancel";
      reviewNote?: string;
    }) => {
      const response = await fetch("/api/miniapps/template-market", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify({
          action: "review_request",
          request_id: input.requestId,
          decision: input.decision,
          review_note: input.reviewNote,
        }),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to review template publish request");
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniapps", "template-market"] });
    },
  });
}
