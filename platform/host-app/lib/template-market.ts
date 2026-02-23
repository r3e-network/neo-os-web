import type { SupabaseClient } from "@supabase/supabase-js";

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

export type UpsertTemplateEntryInput = {
  kind: TemplateKind;
  template_id: string;
  version: string;
  owner_user_id: string | null;
  name: string;
  description: string;
  category: string;
  schema: Record<string, unknown>;
  ui_schema: Record<string, unknown>;
  manifest: Record<string, unknown>;
  factory_template_ref?: string | null;
  source_type: TemplateSourceType;
  tags: string[];
  is_active: boolean;
  is_verified: boolean;
};

type Dict = Record<string, unknown>;

const TEMPLATE_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function asTrimmedString(value: unknown): string {
  return asString(value).trim();
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => asTrimmedString(item)).filter(Boolean)));
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(asString(value));
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function tableForKind(kind: TemplateKind): "miniapp_frontend_templates" | "miniapp_contract_templates" {
  return kind === "frontend" ? "miniapp_frontend_templates" : "miniapp_contract_templates";
}

function normalizeRequestStatus(value: unknown): TemplatePublishRequestStatus {
  const raw = asTrimmedString(value).toLowerCase();
  if (raw === "approved") return "approved";
  if (raw === "rejected") return "rejected";
  if (raw === "cancelled") return "cancelled";
  return "pending";
}

function toTemplateCatalogItem(kind: TemplateKind, row: Dict): TemplateCatalogItem {
  const manifestValue = kind === "frontend" ? row.manifest : row.deploy_manifest;
  return {
    row_id: asTrimmedString(row.id),
    template_kind: kind,
    template_id: asTrimmedString(row.template_id),
    version: asTrimmedString(row.version),
    owner_user_id: asTrimmedString(row.owner_user_id) || null,
    name: asTrimmedString(row.name),
    description: asTrimmedString(row.description),
    category: asTrimmedString(row.category) || "utility",
    source_type: normalizeTemplateSourceType(row.source_type),
    tags: asStringArray(row.tags),
    is_active: asBoolean(row.is_active, false),
    is_verified: asBoolean(row.is_verified, false),
    usage_count: Math.max(0, Math.floor(asNumber(row.usage_count))),
    rating_avg: Number.isFinite(asNumber(row.rating_avg)) ? asNumber(row.rating_avg) : null,
    rating_count: Math.max(0, Math.floor(asNumber(row.rating_count))),
    schema: asObject(row.schema),
    ui_schema: asObject(row.ui_schema),
    manifest: asObject(manifestValue),
    factory_template_ref: asTrimmedString(row.factory_template_ref) || null,
    updated_at: asTrimmedString(row.updated_at),
  };
}

function toTemplatePublishRequestRow(row: Dict): TemplatePublishRequestRow {
  return {
    id: asTrimmedString(row.id),
    template_kind: normalizeTemplateKind(row.template_kind) || "frontend",
    template_row_id: asTrimmedString(row.template_row_id),
    status: normalizeRequestStatus(row.status),
    requested_by: asTrimmedString(row.requested_by),
    reviewed_by: asTrimmedString(row.reviewed_by) || null,
    review_note: asTrimmedString(row.review_note) || null,
    created_at: asTrimmedString(row.created_at),
    reviewed_at: asTrimmedString(row.reviewed_at) || null,
  };
}

export function isTemplateApprovalRequired(): boolean {
  const raw = asTrimmedString(process.env.MINIAPP_TEMPLATE_PUBLISH_APPROVAL_REQUIRED).toLowerCase();
  if (!raw) return false;
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

export function isTemplateReviewer(actor: string): boolean {
  const normalizedActor = asTrimmedString(actor).toLowerCase();
  if (!normalizedActor) return false;

  const explicit = asTrimmedString(process.env.MINIAPP_TEMPLATE_PUBLISH_REVIEWERS);
  const fallback = asTrimmedString(process.env.MINIAPP_ADMIN_WALLETS);
  const source = explicit || fallback;

  if (!source) return true;

  const reviewers = source
    .split(",")
    .map((value) => asTrimmedString(value).toLowerCase())
    .filter(Boolean);

  return reviewers.includes(normalizedActor);
}

export function normalizeTemplateKind(value: unknown): TemplateKind | null {
  const raw = asTrimmedString(value).toLowerCase();
  if (raw === "frontend") return "frontend";
  if (raw === "contract") return "contract";
  return null;
}

export function normalizeTemplateSourceType(value: unknown): TemplateSourceType {
  const raw = asTrimmedString(value).toLowerCase();
  if (raw === "miniapp") return "miniapp";
  if (raw === "verified") return "verified";
  return "community";
}

export function normalizeTemplateId(value: unknown): string {
  const normalized = asTrimmedString(value).toLowerCase();
  if (!TEMPLATE_ID_REGEX.test(normalized)) return "";
  return normalized;
}

export async function upsertTemplateEntry(
  supabase: SupabaseClient,
  input: UpsertTemplateEntryInput,
): Promise<TemplateCatalogItem> {
  const table = tableForKind(input.kind);
  const now = new Date().toISOString();

  const basePayload: Dict = {
    template_id: input.template_id,
    version: input.version,
    owner_user_id: input.owner_user_id,
    name: input.name,
    description: input.description,
    category: input.category || "utility",
    schema: input.schema,
    ui_schema: input.ui_schema,
    is_active: input.is_active,
    is_verified: input.is_verified,
    source_type: input.source_type,
    tags: input.tags,
    updated_at: now,
  };

  if (input.kind === "frontend") {
    basePayload.manifest = input.manifest;
  } else {
    basePayload.deploy_manifest = input.manifest;
    basePayload.factory_template_ref = asTrimmedString(input.factory_template_ref) || null;
  }

  const { data, error } = await supabase
    .from(table)
    .upsert(basePayload, { onConflict: "template_id,version" })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to upsert template");
  }

  return toTemplateCatalogItem(input.kind, data as Dict);
}

export async function listTemplateEntries(
  supabase: SupabaseClient,
  options: {
    kind?: TemplateKind | "all";
    template_id?: string;
    category?: string;
    source?: TemplateSourceType | "all";
    active?: "true" | "false" | "all";
    verified?: "true" | "false" | "all";
    search?: string;
    limit?: number;
  } = {},
): Promise<TemplateCatalogItem[]> {
  const kinds: TemplateKind[] =
    options.kind && options.kind !== "all"
      ? [options.kind]
      : ["frontend", "contract"];

  const limit = Math.max(1, Math.min(Number(options.limit || 100), 300));
  const output: TemplateCatalogItem[] = [];

  for (const kind of kinds) {
    const table = tableForKind(kind);
    let query = supabase.from(table).select("*").order("updated_at", { ascending: false }).limit(limit);

    if (options.template_id) {
      query = query.eq("template_id", options.template_id);
    }
    if (options.category) {
      query = query.eq("category", options.category);
    }
    if (options.source && options.source !== "all") {
      query = query.eq("source_type", options.source);
    }
    if (options.active === "true" || options.active === "false") {
      query = query.eq("is_active", options.active === "true");
    }
    if (options.verified === "true" || options.verified === "false") {
      query = query.eq("is_verified", options.verified === "true");
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!Array.isArray(data)) continue;

    for (const row of data) {
      output.push(toTemplateCatalogItem(kind, row as Dict));
    }
  }

  const sorted = output.sort((a, b) => {
    const aTime = Date.parse(a.updated_at || "");
    const bTime = Date.parse(b.updated_at || "");
    if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
    if (!Number.isFinite(aTime)) return 1;
    if (!Number.isFinite(bTime)) return -1;
    return bTime - aTime;
  });

  const search = asTrimmedString(options.search).toLowerCase();
  if (!search) {
    return sorted;
  }

  return sorted.filter((item) => {
    const text = [item.template_id, item.name, item.description, item.category, ...item.tags]
      .map((value) => asTrimmedString(value).toLowerCase())
      .join(" ");
    return text.includes(search);
  });
}

export async function setTemplateEntryPublishState(
  supabase: SupabaseClient,
  params: {
    kind: TemplateKind;
    rowId: string;
    isActive: boolean;
    isVerified?: boolean;
  },
): Promise<TemplateCatalogItem> {
  const table = tableForKind(params.kind);
  const patch: Dict = {
    is_active: params.isActive,
    updated_at: new Date().toISOString(),
  };
  if (params.isVerified !== undefined) {
    patch.is_verified = params.isVerified;
  }

  const { data, error } = await supabase.from(table).update(patch).eq("id", params.rowId).select("*").single();
  if (error || !data) {
    throw error || new Error("Failed to update template publish state");
  }

  return toTemplateCatalogItem(params.kind, data as Dict);
}

export async function createTemplatePublishRequest(
  supabase: SupabaseClient,
  params: {
    templateKind: TemplateKind;
    templateRowId: string;
    requestedBy: string;
    requestNote?: string | null;
  },
): Promise<TemplatePublishRequestRow> {
  const { data: existing, error: existingError } = await supabase
    .from("miniapp_template_publish_requests")
    .select("*")
    .eq("template_kind", params.templateKind)
    .eq("template_row_id", params.templateRowId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    throw new Error("A pending publish request already exists for this template");
  }

  const { data, error } = await supabase
    .from("miniapp_template_publish_requests")
    .insert({
      template_kind: params.templateKind,
      template_row_id: params.templateRowId,
      status: "pending",
      requested_by: params.requestedBy,
      review_note: params.requestNote || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create template publish request");
  }

  return toTemplatePublishRequestRow(data as Dict);
}

export async function getTemplatePublishRequestById(
  supabase: SupabaseClient,
  requestId: string,
): Promise<TemplatePublishRequestRow | null> {
  const { data, error } = await supabase
    .from("miniapp_template_publish_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toTemplatePublishRequestRow(data as Dict);
}

export async function listTemplatePublishRequests(
  supabase: SupabaseClient,
  options: {
    kind?: TemplateKind | "all";
    status?: TemplatePublishRequestStatus | "all";
    limit?: number;
  } = {},
): Promise<TemplatePublishRequestRow[]> {
  const limit = Math.max(1, Math.min(Number(options.limit || 100), 300));
  let query = supabase
    .from("miniapp_template_publish_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.kind && options.kind !== "all") {
    query = query.eq("template_kind", options.kind);
  }
  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map((row) => toTemplatePublishRequestRow(row as Dict));
}

export async function updateTemplatePublishRequestStatus(
  supabase: SupabaseClient,
  params: {
    requestId: string;
    status: Exclude<TemplatePublishRequestStatus, "pending">;
    reviewer: string;
    reviewNote?: string | null;
  },
): Promise<TemplatePublishRequestRow> {
  const patch: Dict = {
    status: params.status,
    reviewed_by: params.reviewer,
    reviewed_at: new Date().toISOString(),
    review_note: params.reviewNote || null,
  };

  const { data, error } = await supabase
    .from("miniapp_template_publish_requests")
    .update(patch)
    .eq("id", params.requestId)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update template publish request");
  }

  return toTemplatePublishRequestRow(data as Dict);
}
