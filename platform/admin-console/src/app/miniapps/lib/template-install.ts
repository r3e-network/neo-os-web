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
  contract_mode?: "template" | "shared" | "router" | "custom";
  contract_instance_id?: string;
  contract_recipe?: Record<string, unknown>;
  contract_modules?: unknown[];
  router_template_ref?: string;
  registries?: Record<string, unknown>;
  module_bindings?: Record<string, unknown>;
  instance_permissions?: Record<string, unknown>;
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
  contract_composition_mode: string;
  contract_instance_id: string;
  contract_recipe_id: string;
  contract_recipe_version: string;
  contract_router_template_ref: string;
  contract_registries_json: string;
  contract_modules_json: string;
  contract_module_bindings_json: string;
  contract_instance_permissions_json: string;
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

  const manifest = payload.manifest || {};
  const composition = asObject(row.contract_composition ?? manifest.contract_composition);
  const recipe = asObject(composition.recipe);
  const modules = Array.isArray(composition.modules) ? composition.modules : [];

  payload.contract_mode = (() => {
    const mode = asString(composition.mode).toLowerCase();
    return mode === "template" || mode === "shared" || mode === "router" || mode === "custom"
      ? mode
      : undefined;
  })();
  payload.contract_instance_id = asString(composition.instance_id) || undefined;
  payload.contract_recipe = Object.keys(recipe).length > 0 ? recipe : undefined;
  payload.contract_modules = modules.length > 0 ? modules : undefined;
  payload.router_template_ref = asString(composition.router_template_ref) || undefined;
  payload.registries = asObject(composition.registries);
  payload.module_bindings = asObject(composition.module_bindings);
  payload.instance_permissions = asObject(composition.instance_permissions);

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

  patch.contract_composition_mode = draft.contract_mode || "";
  patch.contract_instance_id = draft.contract_instance_id || "";
  patch.contract_recipe_id = asString(draft.contract_recipe?.recipe_id);
  patch.contract_recipe_version = asString(draft.contract_recipe?.version);
  patch.contract_router_template_ref = draft.router_template_ref || "";
  if (draft.registries && Object.keys(draft.registries).length > 0) {
    patch.contract_registries_json = stringifyOrFallback(draft.registries, "{}");
  }
  if (draft.contract_modules?.length) {
    patch.contract_modules_json = stringifyOrFallback(draft.contract_modules, "[]");
  }
  if (draft.module_bindings && Object.keys(draft.module_bindings).length > 0) {
    patch.contract_module_bindings_json = stringifyOrFallback(draft.module_bindings, "{}");
  }
  if (draft.instance_permissions && Object.keys(draft.instance_permissions).length > 0) {
    patch.contract_instance_permissions_json = stringifyOrFallback(draft.instance_permissions, "{}");
  }

  return patch;
}
