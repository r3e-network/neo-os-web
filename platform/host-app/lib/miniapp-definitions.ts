import { promises as fs } from "fs";
import path from "path";
import type { MiniAppInfo } from "@/components/types";
import { coerceMiniAppInfo } from "./miniapp";
import { logger } from "./logger";

type Dict = Record<string, unknown>;

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";

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
  const contract = asObject(obj.contract ?? manifest.contract);
  const media = asObject(obj.media ?? manifest.media);
  const integration = asObject(obj.integration ?? manifest.integration);

  const appId = asString(obj.app_id) || `miniapp-${slug}`;
  const name = asString(obj.name) || titleCase(slug);
  const entryUrl = resolveManifestEntryUrl(obj.entry_url, appId);
  const contractHash = asString(obj.contract_hash ?? contract.contract_hash ?? manifest.contract_hash);
  const templateId = asString(obj.template_id ?? contract.template_id ?? manifest.template_id);
  const initParams = obj.init_params ?? contract.init_params ?? manifest.init_params;
  const newsIntegration = obj.news_integration ?? integration.news_integration ?? manifest.news_integration;
  const statsDisplay = obj.stats_display ?? integration.stats_display ?? manifest.stats_display;

  const logoUrl = obj.logo_url ?? content.logo_url ?? media.logo_url ?? media.logo ?? manifest.logo_url;
  const bannerUrl = obj.banner_url ?? content.banner_url ?? media.banner_url ?? media.banner ?? manifest.banner_url;
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

  return {
    ...obj,
    app_id: appId,
    name,
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
    contract: normalizedContract,
    media: {
      ...media,
      icon,
      logo: logoUrl,
      banner: bannerUrl,
    },
    integration: normalizedIntegration,
    manifest: {
      ...manifest,
      contract_hash: contractHash || manifest.contract_hash,
      template_id: templateId || manifest.template_id,
      init_params: initParams ?? manifest.init_params,
      contract: normalizedContract,
      media: {
        ...asObject(manifest.media),
        ...media,
      },
      integration: normalizedIntegration,
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

function getSlugFromFilename(fileName: string): string {
  return fileName.replace(/\.json$/i, "").trim();
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
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => entry.name)
      .sort();

    for (const fileName of jsonFiles) {
      const fullPath = path.join(definitionsDir, fileName);
      const slug = getSlugFromFilename(fileName);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const parsed = JSON.parse(content) as unknown;
        const normalized = normalizeRawDefinition(parsed, slug);
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
    apps.push({ ...app, source: "builtin" });
  }
  return apps;
}
