import type { MiniApp } from "@/types";

type MediaVariant = {
  url: string;
  theme?: "light" | "dark" | "any";
  density?: "1x" | "2x" | "3x";
  locale?: string;
};

type FrontendSpecFormat = "markdown" | "yaml" | "json";

function parseJSONObjectText(input: string, fieldName: string): Record<string, unknown> {
  const source = String(input || "").trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${fieldName} parse error: ${detail}`);
  }
}

function parseJSONVariantArray(input: string, fieldName: string): MediaVariant[] {
  const source = String(input || "").trim();
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON array`);
    }
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => item as MediaVariant)
      .filter((item) => typeof item.url === "string" && item.url.trim().length > 0)
      .map((item) => {
        const themeRaw = typeof item.theme === "string" ? item.theme.trim().toLowerCase() : "";
        const densityRaw = typeof item.density === "string" ? item.density.trim().toLowerCase() : "";
        return {
          url: String(item.url).trim(),
          theme: themeRaw === "light" || themeRaw === "dark" || themeRaw === "any" ? themeRaw : undefined,
          density: densityRaw === "1x" || densityRaw === "2x" || densityRaw === "3x" ? densityRaw : undefined,
          locale: typeof item.locale === "string" ? item.locale.trim() || undefined : undefined,
        };
      });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${fieldName} parse error: ${detail}`);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseCommaSeparatedList(input: string): string[] {
  return Array.from(
    new Set(
      String(input || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeSemverInput(input: string, fieldName: string): string | undefined {
  const value = String(input || "").trim();
  if (!value) return undefined;
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${fieldName} must be semver format like 1.2.3`);
  }
  return value;
}

function stringifyOrFallback(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
}

export function formToConfig(form: Record<string, any>) {
  const frontendSpecContent = String(form.frontend_spec_content || "").trim();
  const frontendSpec = frontendSpecContent
    ? {
        format: form.frontend_spec_format,
        content: frontendSpecContent,
      }
    : undefined;

  const frontendTemplateParams = parseJSONObjectText(form.frontend_template_params_json, "frontend_template_params_json");
  const contractTemplateInitParams = parseJSONObjectText(form.contract_template_init_params_json, "contract_template_init_params_json");
  const contractTemplateInitSchema = parseJSONObjectText(form.contract_template_init_schema_json, "contract_template_init_schema_json");
  const contractTemplateMethodSchema = parseJSONObjectText(form.contract_template_method_schema_json, "contract_template_method_schema_json");
  const contractTemplateSecurityProfile = parseJSONObjectText(form.contract_template_security_profile_json, "contract_template_security_profile_json");
  const contractTemplateRequiresCapabilities = parseCommaSeparatedList(form.contract_template_requires_capabilities);
  const contractTemplateMinFactoryVersion = normalizeSemverInput(
    form.contract_template_min_factory_version,
    "contract_template_min_factory_version",
  );
  const contractTemplateMaxFactoryVersion = normalizeSemverInput(
    form.contract_template_max_factory_version,
    "contract_template_max_factory_version",
  );
  const contractTemplateAuditProvider = String(form.contract_template_audit_provider || "").trim() || undefined;
  const contractTemplateAuditHash = String(form.contract_template_audit_hash || "").trim() || undefined;
  const contractTemplateAuditDate = String(form.contract_template_audit_date || "").trim() || undefined;
  const logic = parseJSONObjectText(form.logic_json, "logic_json");
  const marketplace = parseJSONObjectText(form.marketplace_json, "marketplace_json");
  const logoVariants = parseJSONVariantArray(form.content_logo_variants_json, "content_logo_variants_json");
  const bannerVariants = parseJSONVariantArray(form.content_banner_variants_json, "content_banner_variants_json");

  const normalizedSecurityProfile: Record<string, unknown> = { ...contractTemplateSecurityProfile };
  if (contractTemplateAuditProvider) normalizedSecurityProfile.audit_provider = contractTemplateAuditProvider;
  if (contractTemplateAuditHash) normalizedSecurityProfile.audit_hash = contractTemplateAuditHash;
  if (contractTemplateAuditDate) normalizedSecurityProfile.audit_date = contractTemplateAuditDate;

  const frontendTemplate = {
    template_id: String(form.frontend_template_id || "").trim() || undefined,
    version: String(form.frontend_template_version || "").trim() || undefined,
    variant: String(form.frontend_template_variant || "").trim() || undefined,
    params: Object.keys(frontendTemplateParams).length ? frontendTemplateParams : undefined,
  };

  const contractTemplate = {
    template_id: String(form.contract_template_id || "").trim() || undefined,
    version: String(form.contract_template_version || "").trim() || undefined,
    variant: String(form.contract_template_variant || "").trim() || undefined,
    factory_template_ref: String(form.contract_template_factory_ref || "").trim() || undefined,
    requires_host_capability:
      contractTemplateRequiresCapabilities.length > 0 ? contractTemplateRequiresCapabilities : undefined,
    min_factory_version: contractTemplateMinFactoryVersion,
    max_factory_version: contractTemplateMaxFactoryVersion,
    init_params: Object.keys(contractTemplateInitParams).length ? contractTemplateInitParams : undefined,
    init_schema: Object.keys(contractTemplateInitSchema).length ? contractTemplateInitSchema : undefined,
    method_schema: Object.keys(contractTemplateMethodSchema).length ? contractTemplateMethodSchema : undefined,
    security_profile: Object.keys(normalizedSecurityProfile).length ? normalizedSecurityProfile : undefined,
  };

  return {
    app_id: form.app_id, name: form.name, entry_url: form.entry_url,
    name_zh: form.name_zh || undefined,
    description_zh: form.description_zh || undefined,
    i18n: {
      name_zh: form.name_zh || undefined,
      description_zh: form.description_zh || undefined,
    },
    developer_user_id: form.developer_user_id || undefined,
    template_type: form.blueprint || "default",
    template: {
      template_type: form.blueprint || "default",
      frontend_template: frontendTemplate,
      contract_template: contractTemplate,
    },
    frontend_template: frontendTemplate,
    contract_template: contractTemplate,
    version: form.version || "1.0.0", developer_pubkey: form.developer_pubkey,
    callback_contract: form.callback_contract || undefined,
    callback_method: form.callback_method || undefined,
    blueprint: form.blueprint || undefined,
    detail_template: form.detail_template || undefined,
    frontend_spec: frontendSpec,
    attestation_required: form.attestation_required,
    permissions: form.permissions,
    limits: {
      max_gas_per_tx: form.max_gas_per_tx || undefined,
      daily_gas_cap_per_user: form.daily_gas_cap_per_user || undefined,
      governance_cap: form.governance_cap || undefined,
    },
    assets_allowed: String(form.assets_allowed || "").split(",").map((s) => s.trim()).filter(Boolean),
    governance_assets_allowed: String(form.governance_assets_allowed || "").split(",").map((s) => s.trim()).filter(Boolean),
    contracts: Array.isArray(form.contracts) ? form.contracts.filter((c) => c.name && c.hash) : [],
    operations: Array.isArray(form.operations) ? form.operations.filter((o) => o.name && o.method).map((o) => ({
      name: o.name, method: o.method,
      description: o.description || undefined,
      gas_cost: o.gas_cost || undefined,
      button_style: o.button_style || undefined,
      confirm_message: o.confirm_message || undefined,
      params: Array.isArray(o.params) ? o.params.filter((p: any) => p.name && p.type).map((p: any) => ({
        name: p.name, type: p.type,
        label: p.label || undefined,
        required: p.required,
        default_value: p.default_value || undefined,
        placeholder: p.placeholder || undefined,
        options: p.options ? (() => { try { return JSON.parse(p.options); } catch { return undefined; } })() : undefined,
      })) : [],
    })) : [],
    components: Array.isArray(form.components) ? form.components.filter((c) => c.type).map((c) => ({
      type: c.type, display: c.display || undefined,
      props: (() => { try { return c.props ? JSON.parse(c.props) : {}; } catch { return {}; } })(),
    })) : [],
    content: {
      description: form.content_description || undefined,
      icon_url: form.content_icon_url || undefined,
      logo_url: form.content_logo_url || undefined,
      banner_url: form.content_banner_url || undefined,
      docs_url: form.content_docs_url || undefined,
      category: form.content_category || undefined,
      tags: form.content_tags ? String(form.content_tags).split(",").map((s) => s.trim()).filter(Boolean) : [],
    },
    media: {
      icon: form.content_icon_url || undefined,
      logo: form.content_logo_url || undefined,
      banner: form.content_banner_url || undefined,
      logo_variants: logoVariants.length > 0 ? logoVariants : undefined,
      banner_variants: bannerVariants.length > 0 ? bannerVariants : undefined,
    },
    logic: Object.keys(logic).length > 0 ? logic : undefined,
    marketplace: Object.keys(marketplace).length > 0 ? marketplace : undefined,
  };
}

export function appToForm(app: MiniApp): Record<string, any> {
  const m = (app.manifest || {}) as Record<string, unknown>;
  const content = (m.content && typeof m.content === "object") ? m.content as Record<string, unknown> : {};
  const media = (m.media && typeof m.media === "object") ? m.media as Record<string, unknown> : {};
  const i18n = (m.i18n && typeof m.i18n === "object") ? m.i18n as Record<string, unknown> : {};
  const templateContainer = (m.template && typeof m.template === "object") ? m.template as Record<string, unknown> : {};
  const frontendTemplate = (m.frontend_template && typeof m.frontend_template === "object")
    ? m.frontend_template as Record<string, unknown>
    : (templateContainer.frontend_template && typeof templateContainer.frontend_template === "object")
      ? templateContainer.frontend_template as Record<string, unknown>
      : {};
  const contractTemplate = (m.contract_template && typeof m.contract_template === "object")
    ? m.contract_template as Record<string, unknown>
    : (templateContainer.contract_template && typeof templateContainer.contract_template === "object")
      ? templateContainer.contract_template as Record<string, unknown>
      : {};
  const contractTemplateSecurityProfile = asObject(contractTemplate.security_profile);
  const contracts = Array.isArray(m.contracts) ? m.contracts as Array<Record<string, unknown>> : [];
  const operations = Array.isArray(m.operations) ? (m.operations as Array<Record<string, unknown>>).map(o => ({
    name: String(o.name || ""), method: String(o.method || ""), description: String(o.description || ""), gas_cost: String(o.gas_cost || ""),
    button_style: String(o.button_style || ""), confirm_message: String(o.confirm_message || ""),
    params: Array.isArray(o.params) ? (o.params as Array<Record<string, unknown>>).map(p => ({
      name: String(p.name || ""), type: String(p.type || "string"), label: String(p.label || ""),
      required: p.required !== false, default_value: String(p.default_value || ""),
      placeholder: String(p.placeholder || ""),
      options: Array.isArray(p.options) ? JSON.stringify(p.options) : "",
    })) : [],
  })) : [];
  const frontendSpecRaw = m.frontend_spec ?? m.ui_spec;
  let frontendSpecFormat: FrontendSpecFormat = "markdown";
  let frontendSpecContent = "";

  if (typeof frontendSpecRaw === "string") {
    frontendSpecContent = frontendSpecRaw;
  } else if (frontendSpecRaw && typeof frontendSpecRaw === "object" && !Array.isArray(frontendSpecRaw)) {
    const specObj = frontendSpecRaw as Record<string, unknown>;
    const candidateFormat = String(specObj.format || "").trim().toLowerCase();
    if (candidateFormat === "yaml" || candidateFormat === "json" || candidateFormat === "markdown") {
      frontendSpecFormat = candidateFormat;
    }
    if (typeof specObj.content === "string") {
      frontendSpecContent = specObj.content;
    } else {
      frontendSpecFormat = "json";
      frontendSpecContent = JSON.stringify(specObj, null, 2);
    }
  }

  return {
    app_id: app.app_id,
    name: String(m.name || app.app_id),
    name_zh: String(m.name_zh || i18n.name_zh || ""),
    entry_url: app.entry_url,
    developer_user_id: app.developer_user_id || "",
    version: String(m.version || "1.0.0"),
    description_zh: String(m.description_zh || i18n.description_zh || ""),
    developer_pubkey: app.developer_pubkey || "",
    callback_contract: String(m.callback_contract || ""),
    callback_method: String(m.callback_method || ""),
    blueprint: String(m.blueprint || (m.admin as Record<string, unknown>)?.blueprint || "default"),
    detail_template: (m.detail_template || m.page_template || null),
    frontend_template_id: String(frontendTemplate.template_id || ""),
    frontend_template_version: String(frontendTemplate.version || "1.0.0"),
    frontend_template_variant: String(frontendTemplate.variant || ""),
    frontend_template_params_json: stringifyOrFallback(frontendTemplate.params, "{}"),
    contract_template_id: String(contractTemplate.template_id || m.template_id || ""),
    contract_template_version: String(contractTemplate.version || "1.0.0"),
    contract_template_variant: String(contractTemplate.variant || ""),
    contract_template_factory_ref: String(contractTemplate.factory_template_ref || ""),
    contract_template_init_params_json: stringifyOrFallback(contractTemplate.init_params || m.init_params, "{}"),
    contract_template_init_schema_json: stringifyOrFallback(contractTemplate.init_schema, "{}"),
    contract_template_method_schema_json: stringifyOrFallback(contractTemplate.method_schema, "{}"),
    contract_template_security_profile_json: stringifyOrFallback(contractTemplateSecurityProfile, "{}"),
    contract_template_requires_capabilities: Array.isArray(contractTemplate.requires_host_capability)
      ? contractTemplate.requires_host_capability.map((item) => String(item || "").trim()).filter(Boolean).join(", ")
      : "",
    contract_template_min_factory_version: String(contractTemplate.min_factory_version || ""),
    contract_template_max_factory_version: String(contractTemplate.max_factory_version || ""),
    contract_template_audit_provider: String(contractTemplateSecurityProfile.audit_provider || ""),
    contract_template_audit_hash: String(contractTemplateSecurityProfile.audit_hash || ""),
    contract_template_audit_date: String(contractTemplateSecurityProfile.audit_date || ""),
    logic_json: stringifyOrFallback(m.logic, "{}"),
    marketplace_json: stringifyOrFallback(m.marketplace, "{}"),
    assets_allowed: (app.assets_allowed || []).join(", "),
    governance_assets_allowed: (app.governance_assets_allowed || []).join(", "),
    daily_gas_cap_per_user: String(app.limits?.daily_gas_cap_per_user || ""),
    governance_cap: String(app.limits?.governance_cap || ""),
    max_gas_per_tx: String((m.limits as Record<string, unknown>)?.max_gas_per_tx || ""),
    attestation_required: !!m.attestation_required,
    permissions: Object.fromEntries(Object.entries(app.permissions || {}).map(([k, v]) => [k, !!v])),
    contracts,
    operations,
    components: Array.isArray(m.components)
      ? (m.components as Array<Record<string, unknown>>).map((c) => ({
          type: String(c.type || ""),
          display: String(c.display || ""),
          props: JSON.stringify((c.props && typeof c.props === "object") ? c.props : {}, null, 2),
        }))
      : [],
    frontend_spec_format: frontendSpecFormat,
    frontend_spec_content: frontendSpecContent,
    content_description: String(content.description || ""),
    content_icon_url: String(content.icon_url || m.icon || media.icon || ""),
    content_logo_url: String(content.logo_url || m.logo_url || media.logo_url || media.logo || ""),
    content_banner_url: String(content.banner_url || m.banner_url || media.banner_url || media.banner || ""),
    content_logo_variants_json: stringifyOrFallback(media.logo_variants, "[]"),
    content_banner_variants_json: stringifyOrFallback(media.banner_variants, "[]"),
    content_docs_url: String(content.docs_url || ""),
    content_category: String(content.category || ""),
    content_tags: Array.isArray(content.tags) ? (content.tags as string[]).join(", ") : "",
  };
}
