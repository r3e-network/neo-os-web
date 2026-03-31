// =============================================================================
// React Query Hooks - Template Market
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS } from "@/lib/constants";

export type TemplateKind = "frontend" | "contract";
export type TemplateSourceType = "miniapp" | "community" | "verified";
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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
