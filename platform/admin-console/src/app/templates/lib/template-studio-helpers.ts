import yaml from "js-yaml";
import type {
  TemplateCatalogItem,
  TemplateKind,
  TemplatePublishRequestRow,
  TemplateSourceType,
} from "@/lib/hooks/useMiniApps";

export type TemplateManifestFormat = "json" | "yaml";

export const CATEGORIES = [
  "all",
  "gaming",
  "defi",
  "social",
  "nft",
  "governance",
  "utility",
  "data",
];

export const EMPTY_FORM = {
  kind: "frontend" as TemplateKind,
  template_id: "",
  version: "1.0.0",
  name: "",
  description: "",
  category: "utility",
  source_type: "community" as TemplateSourceType,
  tags: "",
  factory_template_ref: "",
  schema_text: "{}",
  ui_schema_text: "{}",
  manifest_format: "json" as TemplateManifestFormat,
  manifest_text: '{\n "template": {\n "id": "example"\n }\n}',
};

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

export function parseManifest(
  text: string,
  format: TemplateManifestFormat,
): Record<string, unknown> {
  const source = String(text || "").trim();
  if (!source) {
    throw new Error("Template manifest is required");
  }

  if (format === "json") {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Manifest must be an object");
    }
    return parsed as Record<string, unknown>;
  }

  const parsed = yaml.load(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("YAML manifest must resolve to an object");
  }
  return parsed as Record<string, unknown>;
}

export function parseJSONObject(
  text: string,
  field: string,
): Record<string, unknown> {
  const source = String(text || "").trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${field} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${field} parse error: ${detail}`);
  }
}

export function parseTemplateId(input: string): string {
  const value = String(input || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error(
      `parseTemplateId: invalid template_id="${value}" — must be lowercase letters/numbers with . _ -`,
    );
  }
  return value;
}

export function formatDateTime(value: string): string {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return value || "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

export function sourceBadgeVariant(
  source: TemplateSourceType,
): "info" | "success" | "default" {
  if (source === "verified") return "success";
  if (source === "miniapp") return "info";
  return "default";
}

export function kindBadgeVariant(kind: TemplateKind): "warning" | "info" {
  return kind === "contract" ? "warning" : "info";
}

export function requestBadgeVariant(
  status: TemplatePublishRequestRow["status"],
): "warning" | "success" | "danger" | "default" {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "default";
}

export function stringifyManifest(manifest: Record<string, unknown>): string {
  return JSON.stringify(manifest, null, 2);
}

export type MiniAppBuilderInstallDraft = {
  source: "template_studio";
  installed_at: string;
  template_kind: TemplateKind;
  template_id: string;
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

export function buildMiniAppInstallDraft(
  item: TemplateCatalogItem,
): MiniAppBuilderInstallDraft {
  const manifest = asObject(item.manifest);
  const templateContainer = asObject(manifest.template);
  const frontendTemplate = asObject(
    manifest.frontend_template ?? templateContainer.frontend_template,
  );
  const contractTemplate = asObject(
    manifest.contract_template ?? templateContainer.contract_template,
  );
  const binding =
    item.template_kind === "contract" ? contractTemplate : frontendTemplate;
  const contractSecurityProfile = asObject(contractTemplate.security_profile);

  const templateId = asString(binding.template_id) || item.template_id;
  const version =
    asString(binding.version) || asString(item.version) || "1.0.0";
  const variant = asString(binding.variant);
  const draft: MiniAppBuilderInstallDraft = {
    source: "template_studio",
    installed_at: new Date().toISOString(),
    template_kind: item.template_kind,
    template_id: templateId,
    version,
    variant: variant || undefined,
    name: asString(item.name) || undefined,
    description: asString(item.description) || undefined,
    category: asString(item.category) || undefined,
    tags: Array.isArray(item.tags) ? item.tags : [],
    manifest,
  };

  if (item.template_kind === "frontend") {
    draft.params = asObject(binding.params);
    return draft;
  }

  draft.factory_template_ref =
    asString(
      contractTemplate.factory_template_ref || item.factory_template_ref,
    ) || undefined;
  draft.init_params = asObject(
    contractTemplate.init_params || manifest.init_params,
  );
  draft.init_schema = asObject(contractTemplate.init_schema);
  draft.method_schema = asObject(contractTemplate.method_schema);
  draft.security_profile = contractSecurityProfile;
  draft.requires_host_capability = asStringArray(
    contractTemplate.requires_host_capability,
  );
  draft.min_factory_version =
    asString(contractTemplate.min_factory_version) || undefined;
  draft.max_factory_version =
    asString(contractTemplate.max_factory_version) || undefined;

  return draft;
}
