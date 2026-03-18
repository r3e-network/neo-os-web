import { existsSync, statSync, promises as fs } from "fs";
import path from "path";
import yaml from "js-yaml";
import type { MiniAppInfo } from "@/components/types";
import { coerceMiniAppInfo } from "./miniapp";
import { logger } from "./logger";
import { canonicalizeMiniAppId } from "./miniapp-id";

type Dict = Record<string, unknown>;

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";
const DEFINITION_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);

export type MiniAppDefinitionPayload = {
  fileName: string;
  slug: string;
  fullPath: string;
  payload: Dict;
};

export type MiniAppDefinitionLoadError = {
  fileName: string;
  slug: string;
  fullPath: string;
  error: string;
};

export type MiniAppDefinitionLoadResult = {
  definitionsDir: string;
  definitions: MiniAppDefinitionPayload[];
  errors: MiniAppDefinitionLoadError[];
};

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asOptionalString(value: unknown): string | undefined {
  const out = asString(value);
  return out || undefined;
}

function canonicalizeAppId(rawAppId: unknown, slug: string): string {
  return canonicalizeMiniAppId(rawAppId, {
    fallbackSlug: slug,
    coerceMiniappPrefix: true,
  });
}

function normalizeMediaVariants(raw: unknown): Array<{
  url: string;
  theme?: "light" | "dark" | "any";
  density?: "1x" | "2x" | "3x";
  locale?: string;
}> {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map((item) => asObject(item))
    .map((item) => {
      const getStr = (v: unknown) => typeof v === "string" ? v.trim() : "";
      const url = getStr(item.url);
      if (!url) return null;
      const themeRaw = getStr(item.theme).toLowerCase();
      const densityRaw = getStr(item.density).toLowerCase();
      const locale = getStr(item.locale);
      const res: any = { url };
      if (themeRaw === "light" || themeRaw === "dark" || themeRaw === "any") res.theme = themeRaw;
      if (densityRaw === "1x" || densityRaw === "2x" || densityRaw === "3x") res.density = densityRaw;
      if (locale) res.locale = locale;
      return res;
    });
  return items.filter((x) => x !== null) as any;
}

export function parseMiniAppDefinitionContent(content: string): unknown {
  const input = String(content || "").trim();
  if (!input) {
    throw new Error("definition file is empty");
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    // Continue to YAML parsing.
  }

  try {
    const parsed = yaml.load(input);
    if (parsed === undefined || parsed === null) {
      throw new Error("definition content resolved to empty value");
    }
    return parsed as unknown;
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "unknown parse error";
    throw new Error(`invalid JSON/YAML definition: ${message}`);
  }
}

function fileHasSupportedDefinitionExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return DEFINITION_EXTENSIONS.has(ext);
}

function resolveManifestEntryUrl(rawEntryUrl: unknown, appId: string): string {
  const input = asString(rawEntryUrl);
  if (!input) return `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(appId)}`;
  if (input.startsWith("mf://manifest?")) return input;
  return `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(appId)}`;
}

function titleCase(input: string): string {
  return input
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeRawDefinition(raw: unknown, slug: string): Dict {
  const obj = asObject(raw);
  const content = asObject(obj.content);
  const manifest = asObject(obj.manifest);
  const i18n = asObject(obj.i18n ?? manifest.i18n);
  const template = asObject(obj.template ?? manifest.template);
  const contract = asObject(obj.contract ?? manifest.contract);
  const media = asObject(obj.media ?? manifest.media);
  const integration = asObject(obj.integration ?? manifest.integration);
  const contractTemplate = asObject(obj.contract_template ?? template.contract_template ?? manifest.contract_template);
  const frontendTemplate = asObject(obj.frontend_template ?? template.frontend_template ?? manifest.frontend_template);
  const logic = asObject(obj.logic ?? manifest.logic);
  const marketplace = asObject(obj.marketplace ?? manifest.marketplace);

  const appId = canonicalizeAppId(obj.app_id, slug);
  const name = asString(obj.name) || titleCase(slug);
  const nameEn = asOptionalString(obj.name_en ?? i18n.name_en ?? manifest.name_en);
  const nameZh = asOptionalString(obj.name_zh ?? i18n.name_zh ?? manifest.name_zh);
  const descriptionEn = asOptionalString(obj.description_en ?? i18n.description_en ?? manifest.description_en);
  const descriptionZh = asOptionalString(obj.description_zh ?? i18n.description_zh ?? manifest.description_zh);
  const templateType = asOptionalString(obj.template_type ?? template.template_type ?? manifest.template_type);
  const entryUrl = resolveManifestEntryUrl(obj.entry_url, appId);
  const contractHash = asString(obj.contract_hash ?? contract.contract_hash ?? manifest.contract_hash);
  const templateId = asString(obj.template_id ?? contract.template_id ?? manifest.template_id);
  const initParams = obj.init_params ?? contract.init_params ?? manifest.init_params;
  const newsIntegration = obj.news_integration ?? integration.news_integration ?? manifest.news_integration;
  const statsDisplay = obj.stats_display ?? integration.stats_display ?? manifest.stats_display;

  const logoUrl = obj.logo_url ?? content.logo_url ?? media.logo_url ?? media.logo ?? manifest.logo_url;
  const bannerUrl = obj.banner_url ?? content.banner_url ?? media.banner_url ?? media.banner ?? manifest.banner_url;
  const logoVariants = normalizeMediaVariants(media.logo_variants ?? asObject(manifest.media).logo_variants);
  const bannerVariants = normalizeMediaVariants(media.banner_variants ?? asObject(manifest.media).banner_variants);
  const docsUrl = obj.docs_url ?? content.docs_url ?? manifest.docs_url;
  const icon = obj.icon ?? content.icon ?? media.icon ?? manifest.icon ?? "🧩";
  const category = obj.category ?? content.category ?? manifest.category ?? "utility";

  const normalizedContract = {
    ...asObject(manifest.contract),
    ...contract,
    template_id: templateId || undefined,
    init_params: initParams,
    contract_hash: contractHash || undefined,
  };

  const normalizedIntegration = {
    ...asObject(manifest.integration),
    ...integration,
    news_integration: newsIntegration,
    stats_display: statsDisplay,
  };

  const normalizedTemplate = {
    ...asObject(manifest.template),
    ...template,
    template_type: templateType,
    contract_template: {
      ...asObject(asObject(manifest.template).contract_template),
      ...asObject(manifest.contract_template),
      ...contractTemplate,
    },
    frontend_template: {
      ...asObject(asObject(manifest.template).frontend_template),
      ...asObject(manifest.frontend_template),
      ...frontendTemplate,
    },
  };

  const normalizedI18n = {
    ...asObject(manifest.i18n),
    ...i18n,
    name_en: nameEn,
    description_en: descriptionEn,
    name_zh: nameZh,
    description_zh: descriptionZh,
  };

  return {
    ...obj,
    app_id: appId,
    name,
    name_en: nameEn,
    name_zh: nameZh,
    description_en: descriptionEn,
    description_zh: descriptionZh,
    template_type: templateType,
    entry_url: entryUrl,
    description: obj.description ?? content.description ?? manifest.description,
    icon,
    category,
    logo_url: logoUrl,
    banner_url: bannerUrl,
    docs_url: docsUrl,
    contract_hash: contractHash || undefined,
    template_id: templateId || undefined,
    init_params: initParams,
    news_integration: newsIntegration,
    stats_display: statsDisplay,
    contract_template: normalizedTemplate.contract_template,
    frontend_template: normalizedTemplate.frontend_template,
    i18n: normalizedI18n,
    logic,
    marketplace,
    template: normalizedTemplate,
    contract: normalizedContract,
    media: {
      ...media,
      icon,
      logo: logoUrl,
      banner: bannerUrl,
      logo_variants: logoVariants,
      banner_variants: bannerVariants,
    },
    integration: normalizedIntegration,
    manifest: {
      ...manifest,
      contract_hash: contractHash || manifest.contract_hash,
      template_id: templateId || manifest.template_id,
      init_params: initParams ?? manifest.init_params,
      contract: normalizedContract,
      contract_template: normalizedTemplate.contract_template,
      frontend_template: normalizedTemplate.frontend_template,
      template: normalizedTemplate,
      template_type: templateType ?? manifest.template_type,
      media: {
        ...asObject(manifest.media),
        ...media,
        logo_variants: logoVariants.length > 0 ? logoVariants : asObject(manifest.media).logo_variants,
        banner_variants: bannerVariants.length > 0 ? bannerVariants : asObject(manifest.media).banner_variants,
      },
      logic: Object.keys(logic).length > 0 ? logic : manifest.logic,
      marketplace: Object.keys(marketplace).length > 0 ? marketplace : manifest.marketplace,
      integration: normalizedIntegration,
      i18n: normalizedI18n,
      name_en: nameEn ?? manifest.name_en,
      name_zh: nameZh ?? manifest.name_zh,
      description_en: descriptionEn ?? manifest.description_en,
      description_zh: descriptionZh ?? manifest.description_zh,
      news_integration: newsIntegration ?? manifest.news_integration,
      stats_display: statsDisplay ?? manifest.stats_display,
      logo_url: logoUrl ?? manifest.logo_url,
      banner_url: bannerUrl ?? manifest.banner_url,
      docs_url: docsUrl ?? manifest.docs_url,
      frontend_spec: obj.frontend_spec ?? manifest.frontend_spec,
      operations: obj.operations ?? manifest.operations,
      page_template: obj.page_template ?? obj.detail_template ?? manifest.page_template ?? manifest.detail_template,
      detail_template: obj.detail_template ?? obj.page_template ?? manifest.detail_template ?? manifest.page_template,
    },
  };
}

function getDefinitionsDir(): string {
  const fromEnv = asString(process.env.MINIAPP_DEFINITIONS_DIR);
  if (fromEnv) return fromEnv;

  return path.join(process.cwd(), "public", "miniapp-definitions");
}

function getBundledAppsDir(): string {
  return path.resolve(process.cwd(), "..", "..", "apps");
}

function getMiniAppManifestPath(slug: string): string {
  return path.resolve(process.cwd(), "..", "..", "apps", slug, "neo-manifest.json");
}

async function loadBundledManifest(slug: string): Promise<Dict | null> {
  const manifestPath = getMiniAppManifestPath(slug);
  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Dict) : null;
  } catch {
    return null;
  }
}

function mergeBundledManifest(raw: unknown, bundledManifest: Dict | null): Dict {
  const obj = asObject(raw);
  if (!bundledManifest) return obj;
  return {
    ...bundledManifest,
    ...obj,
    manifest: {
      ...bundledManifest,
      ...asObject(obj.manifest),
    },
  };
}

async function listBundledManifestSlugs(): Promise<string[]> {
  const appsDir = getBundledAppsDir();
  try {
    const entries = await fs.readdir(appsDir, { withFileTypes: true });
    const slugs: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name.trim();
      if (!slug || slug === "shared") continue;
      const manifestPath = path.join(appsDir, slug, "neo-manifest.json");
      if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) continue;
      slugs.push(slug);
    }
    return slugs.sort();
  } catch {
    return [];
  }
}

function buildManifestOnlyDefinition(slug: string, bundledManifest: Dict): Dict {
  const appId = canonicalizeAppId(bundledManifest.id, slug);
  return {
    app_id: appId,
    name: asString(bundledManifest.name) || titleCase(slug),
    description: asString(bundledManifest.description),
    category: asString(bundledManifest.category) || "utility",
    entry_url: `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(appId)}`,
    status: "active",
    manifest: bundledManifest,
  };
}

function getSlugFromFilename(fileName: string): string {
  return path.parse(fileName).name.trim();
}

function shouldSkipDefinitionFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (lower === "miniapp-config.schema.json") return true;
  if (lower.endsWith(".schema.json")) return true;
  if (lower.includes(".example.")) return true;
  return false;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error";
}

export async function loadMiniAppDefinitionPayloads(): Promise<MiniAppDefinitionLoadResult> {
  const definitionsDir = getDefinitionsDir();
  const definitions: MiniAppDefinitionPayload[] = [];
  const errors: MiniAppDefinitionLoadError[] = [];

  try {
    const entries = await fs.readdir(definitionsDir, { withFileTypes: true });
    const definitionFiles = entries
      .filter((entry) => entry.isFile() && fileHasSupportedDefinitionExtension(entry.name) && !shouldSkipDefinitionFile(entry.name))
      .map((entry) => entry.name)
      .sort();

    for (const fileName of definitionFiles) {
      const fullPath = path.join(definitionsDir, fileName);
      const slug = getSlugFromFilename(fileName);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const parsed = parseMiniAppDefinitionContent(content);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("definition payload must be a JSON/YAML object");
        }
        const bundledManifest = await loadBundledManifest(slug);
        const normalized = normalizeRawDefinition(mergeBundledManifest(parsed, bundledManifest), slug);
        definitions.push({
          fileName,
          slug,
          fullPath,
          payload: normalized,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        logger.warn(`Failed to parse miniapp definition ${fileName}:`, error);
        errors.push({
          fileName,
          slug,
          fullPath,
          error: message,
        });
      }
    }

    const definitionSlugs = new Set(definitions.map((definition) => definition.slug));
    const bundledSlugs = await listBundledManifestSlugs();
    for (const slug of bundledSlugs) {
      if (definitionSlugs.has(slug)) continue;
      try {
        const bundledManifest = await loadBundledManifest(slug);
        if (!bundledManifest) continue;
        definitions.push({
          fileName: `${slug}/neo-manifest.json`,
          slug,
          fullPath: getMiniAppManifestPath(slug),
          payload: normalizeRawDefinition(buildManifestOnlyDefinition(slug, bundledManifest), slug),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        errors.push({
          fileName: `${slug}/neo-manifest.json`,
          slug,
          fullPath: getMiniAppManifestPath(slug),
          error: message,
        });
      }
    }

    return { definitionsDir, definitions, errors };
  } catch {
    return { definitionsDir, definitions: [], errors: [] };
  }
}

export async function loadMiniAppDefinitions(): Promise<MiniAppInfo[]> {
  if (process.env.NODE_ENV === "test" && !process.env.MINIAPP_DEFINITIONS_DIR) {
    return [];
  }

  const loaded = await loadMiniAppDefinitionPayloads();
  const apps: MiniAppInfo[] = [];
  for (const definition of loaded.definitions) {
    const app = coerceMiniAppInfo(definition.payload);
    if (!app) continue;
    apps.push({ ...app, source: "miniapp" });
  }
  return apps;
}
