import type { MiniAppInfo } from "@/components/types";
import { compactMiniAppManifestForCatalog } from "@/lib/miniapp-catalog-view";

function toSerializablePermissions(
  value: MiniAppInfo["permissions"] | null | undefined,
): MiniAppInfo["permissions"] {
  return JSON.parse(JSON.stringify(value ?? {})) as MiniAppInfo["permissions"];
}

/**
 * Shapes a {@link MiniAppInfo} into the minimal, JSON-serializable form passed
 * as static props from the catalog SSG pages (`/` and `/miniapps`). Strips
 * non-serializable/undefined fields, normalizes optional fields to `null`, and
 * compacts the manifest so Next.js can serialize the page props.
 *
 * Both catalog pages share this single definition to avoid the SSG prop shape
 * drifting between them.
 */
export function serializeMiniAppForCatalogProps(app: MiniAppInfo): MiniAppInfo {
  return {
    app_id: app.app_id,
    name: app.name,
    name_en: app.name_en ?? null,
    name_zh: app.name_zh ?? null,
    name_ja: app.name_ja ?? null,
    name_ko: app.name_ko ?? null,
    description: app.description,
    description_en: app.description_en ?? null,
    description_zh: app.description_zh ?? null,
    description_ja: app.description_ja ?? null,
    description_ko: app.description_ko ?? null,
    icon: app.icon,
    category_name: app.category_name ?? null,
    category_name_zh: app.category_name_zh ?? null,
    category_name_ja: app.category_name_ja ?? null,
    category_name_ko: app.category_name_ko ?? null,
    logo_url: app.logo_url ?? null,
    banner_url: app.banner_url ?? null,
    category: app.category,
    entry_url: app.entry_url,
    contract_hash: app.contract_hash ?? null,
    status: app.status ?? null,
    source: app.source ?? "miniapp",
    permissions: toSerializablePermissions(app.permissions),
    manifest: compactMiniAppManifestForCatalog(app.manifest),
  };
}

/** Maps a list of mini-apps through {@link serializeMiniAppForCatalogProps}. */
export function serializeMiniAppsForCatalogProps(
  apps: MiniAppInfo[],
): MiniAppInfo[] {
  return apps.map(serializeMiniAppForCatalogProps);
}
