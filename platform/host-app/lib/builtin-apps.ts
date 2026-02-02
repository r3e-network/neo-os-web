import type { MiniAppInfo } from "../components/types";
import type { ChainId } from "./chains/types";
import miniappsData from "../data/miniapps.json";

/**
 * Built-in MiniApp catalog - loaded from JSON data file
 *
 * Chain Support:
 * - Each app declares supportedChains in its manifest (neo-manifest.json)
 * - Apps without supportedChains are pure frontend apps (no chain interaction)
 * - Platform reads from manifest - NO default chain fallback
 *
 * Entry URLs:
 * - Built-in catalog apps use `/miniapps/{app-name}/index.html` (served from static H5 builds)
 * - Module Federation is still supported when `entry_url` uses `mf://...`
 */

type MiniAppCategory = "gaming" | "defi" | "social" | "nft" | "governance" | "utility";

// Type for JSON data (supportedChains comes from manifest, empty array if not specified)
type JsonMiniAppInfo = Omit<MiniAppInfo, "category" | "supportedChains"> & {
  supportedChains?: ChainId[];
};

// Type assertion for JSON data
const data = miniappsData as Record<MiniAppCategory, JsonMiniAppInfo[]>;

// Add category - supportedChains comes from manifest only (empty array if not declared)
const addCategory = (apps: JsonMiniAppInfo[], category: MiniAppCategory): MiniAppInfo[] =>
  apps.map((app) => ({
    ...app,
    category,
    // Use manifest value or empty array (pure frontend app)
    supportedChains: app.supportedChains ?? [],
  }));

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
      const match = app.entry_url.match(/\/(?:miniapps|miniapp-assets)\/([^/]+)/);
      if (match) shortId = match[1];
    }
    return [shortId, app];
  }),
);

// Find a built-in app by ID (supports both full ID and short ID)
export function getBuiltinApp(appId: string): MiniAppInfo | undefined {
  return BUILTIN_APPS_MAP[appId] ?? BUILTIN_APPS_SHORT_MAP[appId];
}
