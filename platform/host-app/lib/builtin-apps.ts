import type { MiniAppInfo } from "../components/types";
import miniappsData from "../data/miniapps.json";

/**
 * Built-in MiniApp catalog - loaded from JSON data file
 *
 * Entry URL Migration:
 * - Legacy apps: Use `/miniapps/{app-name}/` format (served from static H5 builds)
 * - New apps: Use `mf://builtin?app={app-id}` format (module federation protocol)
 */

type MiniAppCategory = "gaming" | "defi" | "social" | "nft" | "governance" | "utility";

// Type assertion for JSON data
const data = miniappsData as Record<MiniAppCategory, Omit<MiniAppInfo, "category">[]>;

// Add category to each app
const addCategory = (apps: Omit<MiniAppInfo, "category">[], category: MiniAppCategory): MiniAppInfo[] =>
  apps.map((app) => ({ ...app, category }));

// Category arrays
export const GAMING_APPS = addCategory(data.gaming, "gaming");
export const DEFI_APPS = addCategory(data.defi, "defi");
export const SOCIAL_APPS = addCategory(data.social, "social");
export const NFT_APPS = addCategory(data.nft, "nft");
export const GOVERNANCE_APPS = addCategory(data.governance, "governance");
export const UTILITY_APPS = addCategory(data.utility, "utility");

// Combined list of all apps
export const BUILTIN_APPS: MiniAppInfo[] = [
  ...GAMING_APPS,
  ...DEFI_APPS,
  ...SOCIAL_APPS,
  ...NFT_APPS,
  ...GOVERNANCE_APPS,
  ...UTILITY_APPS,
];

// Lookup map by app_id
export const BUILTIN_APPS_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  BUILTIN_APPS.map((app) => [app.app_id, app]),
);

// Additional lookup map by short ID (without "miniapp-" prefix)
const BUILTIN_APPS_SHORT_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  BUILTIN_APPS.map((app) => {
    let shortId = app.app_id.replace("miniapp-", "");
    if (app.entry_url) {
      const match = app.entry_url.match(/\/miniapps\/([^/]+)/);
      if (match) shortId = match[1];
    }
    return [shortId, app];
  }),
);

// Find a built-in app by ID (supports both full ID and short ID)
export function getBuiltinApp(appId: string): MiniAppInfo | undefined {
  return BUILTIN_APPS_MAP[appId] ?? BUILTIN_APPS_SHORT_MAP[appId];
}
