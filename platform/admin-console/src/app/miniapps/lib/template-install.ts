export const MINIAPP_TEMPLATE_INSTALL_STORAGE_KEY = "miniapp_builder_install_draft_v1";

export type MiniAppBuilderInstallDraft = {
  source?: string;
  installed_at?: string;
  template_kind?: "frontend" | "contract";
  template_id?: string;
  version?: string;
  variant?: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  params?: Record<string, unknown>;
  factory_template_ref?: string;
  init_params?: Record<string, unknown>;
  init_schema?: Record<string, unknown>;
  method_schema?: Record<string, unknown>;
  security_profile?: Record<string, unknown>;
  requires_host_capability?: string[];
  min_factory_version?: string;
  max_factory_version?: string;
  manifest?: Record<string, unknown>;
};

export type InstallDraftTargetSnapshot = {
  name: string;
  content_description: string;
  content_category: string;
  content_tags: string;
};

export type InstallDraftFormPatch = Partial<{
  name: string;
  content_description: string;
  content_category: string;
  content_tags: string;
  frontend_template_id: string;
  frontend_template_version: string;
  frontend_template_variant: string;
  frontend_template_params_json: string;
  contract_template_id: string;
  contract_template_version: string;
  contract_template_variant: string;
  contract_template_factory_ref: string;
  contract_template_init_params_json: string;
  contract_template_init_schema_json: string;
  contract_template_method_schema_json: string;
  contract_template_security_profile_json: string;
  contract_template_audit_provider: string;
  contract_template_audit_hash: string;
  contract_template_audit_date: string;
  contract_template_requires_capabilities: string;
  contract_template_min_factory_version: string;
  contract_template_max_factory_version: string;
}>;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function stringifyOrFallback(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
}

export function normalizeInstallDraft(input: unknown): MiniAppBuilderInstallDraft | null {
  const row = asObject(input);
  const kind = asString(row.template_kind).toLowerCase();
  if (kind !== "frontend" && kind !== "contract") return null;

  const templateId = asString(row.template_id);
  if (!templateId) return null;

  const payload: MiniAppBuilderInstallDraft = {
    source: asString(row.source) || undefined,
    installed_at: asString(row.installed_at) || undefined,
    template_kind: kind,
    template_id: templateId,
    version: asString(row.version) || undefined,
    variant: asString(row.variant) || undefined,
    name: asString(row.name) || undefined,
    description: asString(row.description) || undefined,
    category: asString(row.category) || undefined,
    tags: parseStringArray(row.tags),
    params: asObject(row.params),
    factory_template_ref: asString(row.factory_template_ref) || undefined,
    init_params: asObject(row.init_params),
    init_schema: asObject(row.init_schema),
    method_schema: asObject(row.method_schema),
    security_profile: asObject(row.security_profile),
    requires_host_capability: parseStringArray(row.requires_host_capability),
    min_factory_version: asString(row.min_factory_version) || undefined,
    max_factory_version: asString(row.max_factory_version) || undefined,
    manifest: asObject(row.manifest),
  };

  return payload;
}

export function buildInstallDraftFormPatch(
  draft: MiniAppBuilderInstallDraft,
  current: InstallDraftTargetSnapshot,
): InstallDraftFormPatch {
  const patch: InstallDraftFormPatch = {};

  if (draft.name && !current.name) patch.name = draft.name;
  if (draft.description && !current.content_description) patch.content_description = draft.description;
  if (draft.category && !current.content_category) patch.content_category = draft.category;
  if (draft.tags?.length && !current.content_tags) patch.content_tags = draft.tags.join(", ");

  if (draft.template_kind === "frontend") {
    patch.frontend_template_id = draft.template_id || "";
    patch.frontend_template_version = draft.version || "1.0.0";
    patch.frontend_template_variant = draft.variant || "";
    if (draft.params && Object.keys(draft.params).length > 0) {
      patch.frontend_template_params_json = stringifyOrFallback(draft.params, "{}");
    }
    return patch;
  }

  patch.contract_template_id = draft.template_id || "";
  patch.contract_template_version = draft.version || "1.0.0";
  patch.contract_template_variant = draft.variant || "";
  patch.contract_template_factory_ref = draft.factory_template_ref || "";

  if (draft.init_params && Object.keys(draft.init_params).length > 0) {
    patch.contract_template_init_params_json = stringifyOrFallback(draft.init_params, "{}");
  }
  if (draft.init_schema && Object.keys(draft.init_schema).length > 0) {
    patch.contract_template_init_schema_json = stringifyOrFallback(draft.init_schema, "{}");
  }
  if (draft.method_schema && Object.keys(draft.method_schema).length > 0) {
    patch.contract_template_method_schema_json = stringifyOrFallback(draft.method_schema, "{}");
  }
  if (draft.security_profile && Object.keys(draft.security_profile).length > 0) {
    patch.contract_template_security_profile_json = stringifyOrFallback(draft.security_profile, "{}");
    patch.contract_template_audit_provider = asString(draft.security_profile.audit_provider);
    patch.contract_template_audit_hash = asString(draft.security_profile.audit_hash);
    patch.contract_template_audit_date = asString(draft.security_profile.audit_date);
  }
  if (draft.requires_host_capability?.length) {
    patch.contract_template_requires_capabilities = draft.requires_host_capability.join(", ");
  }
  if (draft.min_factory_version) {
    patch.contract_template_min_factory_version = draft.min_factory_version;
  }
  if (draft.max_factory_version) {
    patch.contract_template_max_factory_version = draft.max_factory_version;
  }

  return patch;
}
