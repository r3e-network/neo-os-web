import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishRequestStatus = "pending" | "approved" | "rejected" | "applied" | "cancelled";

export type PublishRequestRow = {
  id: string;
  app_id: string;
  requested_version_id: string | null;
  requested_version_no: number | null;
  requested_manifest_hash: string;
  requested_by: string;
  request_note: string | null;
  status: PublishRequestStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_version_id: string | null;
  applied_at: string | null;
  requested_at: string;
  updated_at: string;
};

function normalizeStatus(value: unknown): PublishRequestStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "applied") return "applied";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
}

function coerceRow(row: Record<string, unknown>): PublishRequestRow {
  return {
    id: String(row.id || ""),
    app_id: String(row.app_id || ""),
    requested_version_id: row.requested_version_id ? String(row.requested_version_id) : null,
    requested_version_no: typeof row.requested_version_no === "number" ? row.requested_version_no : Number(row.requested_version_no || 0) || null,
    requested_manifest_hash: String(row.requested_manifest_hash || ""),
    requested_by: String(row.requested_by || ""),
    request_note: row.request_note ? String(row.request_note) : null,
    status: normalizeStatus(row.status),
    review_note: row.review_note ? String(row.review_note) : null,
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    applied_version_id: row.applied_version_id ? String(row.applied_version_id) : null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    requested_at: String(row.requested_at || ""),
    updated_at: String(row.updated_at || ""),
  };
}

export async function createPublishRequest(
  supabase: SupabaseClient,
  params: {
    appId: string;
    requestedVersionId?: string | null;
    requestedVersionNo?: number | null;
    requestedManifestHash: string;
    requestedBy: string;
    requestNote?: string | null;
  },
): Promise<PublishRequestRow> {
  const { data: inserted, error } = await supabase
    .from("miniapp_publish_requests")
    .insert({
      app_id: params.appId,
      requested_version_id: params.requestedVersionId || null,
      requested_version_no: params.requestedVersionNo || null,
      requested_manifest_hash: params.requestedManifestHash,
      requested_by: params.requestedBy,
      request_note: params.requestNote || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !inserted) {
    throw error || new Error("Failed to create publish request");
  }

  return coerceRow(inserted as Record<string, unknown>);
}

export async function getPendingPublishRequest(
  supabase: SupabaseClient,
  appId: string,
): Promise<PublishRequestRow | null> {
  const { data, error } = await supabase
    .from("miniapp_publish_requests")
    .select("*")
    .eq("app_id", appId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return coerceRow(data as Record<string, unknown>);
}

export async function listPublishRequests(
  supabase: SupabaseClient,
  params: {
    appId?: string;
    status?: PublishRequestStatus | "all";
    limit?: number;
  },
): Promise<PublishRequestRow[]> {
  const limit = Math.max(1, Math.min(Number(params.limit || 100), 300));

  let query = supabase
    .from("miniapp_publish_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (params.appId) {
    query = query.eq("app_id", params.appId);
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) return [];

  return data.map((item) => coerceRow(item as Record<string, unknown>));
}

export async function updatePublishRequestStatus(
  supabase: SupabaseClient,
  params: {
    requestId: string;
    status: "approved" | "rejected" | "cancelled" | "applied";
    reviewer?: string;
    reviewNote?: string | null;
    appliedVersionId?: string | null;
  },
): Promise<PublishRequestRow> {
  const patch: Record<string, unknown> = {
    status: params.status,
    updated_at: new Date().toISOString(),
  };

  if (params.status === "approved" || params.status === "rejected") {
    patch.reviewed_by = params.reviewer || null;
    patch.reviewed_at = new Date().toISOString();
    patch.review_note = params.reviewNote || null;
  }

  if (params.status === "applied") {
    patch.applied_at = new Date().toISOString();
    patch.applied_version_id = params.appliedVersionId || null;
  }

  const { data, error } = await supabase
    .from("miniapp_publish_requests")
    .update(patch)
    .eq("id", params.requestId)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update publish request status");
  }

  return coerceRow(data as Record<string, unknown>);
}

export function isApprovalRequired(): boolean {
  const raw = String(process.env.MINIAPP_PUBLISH_APPROVAL_REQUIRED || "").trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function isReviewer(actor: string): boolean {
  const normalizedActor = String(actor || "").trim().toLowerCase();
  if (!normalizedActor) return false;

  const reviewers = String(process.env.MINIAPP_PUBLISH_REVIEWERS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (reviewers.length === 0) {
    const fallbackAdmins = String(process.env.MINIAPP_ADMIN_WALLETS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (fallbackAdmins.length === 0) {
      return true;
    }

    return fallbackAdmins.includes(normalizedActor);
  }

  return reviewers.includes(normalizedActor);
}

export function getPublishRequestSlaMinutes(): number {
  const raw = Number.parseInt(String(process.env.MINIAPP_PUBLISH_APPROVAL_SLA_MINUTES || "").trim(), 10);
  if (!Number.isFinite(raw) || raw <= 0) return 60;
  return Math.max(5, Math.min(raw, 7 * 24 * 60));
}

export function getPublishRequestEscalationMinutes(): number {
  const raw = Number.parseInt(String(process.env.MINIAPP_PUBLISH_APPROVAL_ESCALATION_MINUTES || "").trim(), 10);
  if (!Number.isFinite(raw) || raw <= 0) return 180;
  return Math.max(10, Math.min(raw, 14 * 24 * 60));
}

export function classifyPublishRequestTiming(requestedAt: string): {
  ageMinutes: number;
  slaMinutes: number;
  escalationMinutes: number;
  isSlaBreached: boolean;
  isEscalated: boolean;
} {
  const requestedAtMs = Date.parse(String(requestedAt || ""));
  const nowMs = Date.now();
  const ageMinutes = Number.isFinite(requestedAtMs)
    ? Math.max(0, Math.floor((nowMs - requestedAtMs) / 60000))
    : 0;
  const slaMinutes = getPublishRequestSlaMinutes();
  const escalationMinutes = getPublishRequestEscalationMinutes();

  return {
    ageMinutes,
    slaMinutes,
    escalationMinutes,
    isSlaBreached: ageMinutes >= slaMinutes,
    isEscalated: ageMinutes >= escalationMinutes,
  };
}
