// =============================================================================
// React Query Hooks - MiniApp Publish Workflow
// =============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAuthHeaders } from "@/lib/admin-client";
import { DEFAULT_STALE_TIME_MS } from "@/lib/constants";

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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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

      const payload = await response.json().catch((e: unknown) => { console.warn("[useMiniApps] failed to parse JSON response:", e instanceof Error ? e.message : String(e)); return null; }) as {
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
