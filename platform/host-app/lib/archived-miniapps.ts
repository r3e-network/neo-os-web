import { canonicalizeMiniAppId } from "./miniapp-id";

const ARCHIVED_MINIAPP_IDS = new Set([
  "miniapp-neoburger",
  "miniapp-neo-burger",
  "miniapp-flamingo",
  "miniapp-flaminggo",
]);

const ARCHIVED_MINIAPP_SLUGS = new Set([
  "neoburger",
  "neo-burger",
  "flamingo",
  "flaminggo",
]);

export function isArchivedMiniAppId(value: unknown): boolean {
  const normalized = canonicalizeMiniAppId(value, {
    fallbackSlug: String(value || ""),
    coerceMiniappPrefix: true,
  });
  return Boolean(normalized && ARCHIVED_MINIAPP_IDS.has(normalized));
}

export function isArchivedMiniAppSlug(value: unknown): boolean {
  const slug = String(value || "").trim().toLowerCase();
  return Boolean(slug && ARCHIVED_MINIAPP_SLUGS.has(slug));
}

export function filterArchivedMiniApps<T extends { app_id?: unknown }>(apps: T[]): T[] {
  return apps.filter((app) => !isArchivedMiniAppId(app.app_id));
}
