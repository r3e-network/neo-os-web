/**
 * CDN-backed MiniApp bundle resolution.
 *
 * MiniApp and MiniGame sources live in their own repositories now
 * (r3e-network/neo-miniapps, r3e-network/neo-minigames). Their CI builds each
 * app and publishes it to Cloudflare R2 behind the public CDN domain; this
 * module is the platform's only reader of that surface.
 *
 * The layout it consumes (written by each app repo's publish-bundles-r2.mjs):
 *
 *   <kind>/<slug>/<version>/index.html        immutable, cached a year
 *   <kind>/<slug>/<version>/assets/*          immutable, cached a year
 *   meta/<kind>/<slug>/latest.json            60s - the release pointer
 *   catalog/<kind>.json                       60s - meta + artwork only
 *
 * Two properties of that layout matter here. The version is part of the path,
 * so every bundle URL is immutable and the host never has to bust an asset
 * cache - a release is a pointer rewrite. And the catalogue deliberately
 * carries no bundle payload, only metadata and artwork, which is what lets the
 * launcher grid render 78 apps without fetching a single bundle.
 */

export type MiniAppBundleKind = "miniapps" | "minigames";

export const MINIAPP_BUNDLE_KINDS: MiniAppBundleKind[] = ["miniapps", "minigames"];

export type MiniAppCdnApp = {
  app_id: string;
  slug: string;
  kind: MiniAppBundleKind;
  name: string;
  name_zh?: string;
  name_ja?: string;
  description: string;
  description_zh?: string;
  description_ja?: string;
  category: string;
  tags: string[];
  version: string;
  icon_url: string;
  banner_url: string;
  entry_url: string;
  manifest_url: string;
  supported_networks: string[];
  default_network: string;
  contracts: Record<string, unknown>;
  onegate?: Record<string, unknown>;
};

export type MiniAppCdnCatalog = {
  generated_at: string;
  kind: MiniAppBundleKind;
  cdn_base_url: string;
  count: number;
  apps: MiniAppCdnApp[];
};

export type MiniAppBundlePointer = {
  app_id: string;
  slug: string;
  kind: MiniAppBundleKind;
  version: string;
  entry_url: string;
  base_url: string;
  manifest_url: string;
  file_count?: number;
  bytes?: number;
  published_at?: string;
};

const DEFAULT_CDN_BASE_URL = "https://meshmini.app";
const CATALOG_CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;

function trimmed(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function getMiniAppCdnBaseUrl(): string {
  const raw =
    trimmed(process.env.MINIAPP_CDN_BASE_URL) ||
    trimmed(process.env.NEXT_PUBLIC_MINIAPP_CDN_BASE_URL) ||
    DEFAULT_CDN_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * `local` pins the host to bundles under public/miniapps. It exists for offline
 * development and for the Playwright suite, which must not depend on a live CDN.
 */
export function getMiniAppBundleSource(): "cdn" | "local" {
  return trimmed(process.env.MINIAPP_BUNDLE_SOURCE).toLowerCase() === "local" ? "local" : "cdn";
}

export function isMiniAppCdnEnabled(): boolean {
  return getMiniAppBundleSource() === "cdn" && getMiniAppCdnBaseUrl().length > 0;
}

export function buildMiniAppCatalogUrl(kind: MiniAppBundleKind): string {
  return `${getMiniAppCdnBaseUrl()}/catalog/${kind}.json`;
}

export function buildMiniAppPointerUrl(kind: MiniAppBundleKind, slug: string): string {
  return `${getMiniAppCdnBaseUrl()}/meta/${kind}/${encodeURIComponent(slug)}/latest.json`;
}

/** Entry served by the platform itself, used when the CDN is off or unreachable. */
export function buildLocalBundleEntryUrl(slug: string): string {
  return `/miniapps/${slug}/index.html`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  if (typeof fetch !== "function") return null;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(url, {
      ...(controller ? { signal: controller.signal } : {}),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // A CDN hiccup must never take the catalogue down: callers fall back to
    // locally served bundles instead.
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

type CatalogCache = { at: number; apps: MiniAppCdnApp[] };
let catalogCache: CatalogCache | null = null;
let catalogInFlight: Promise<MiniAppCdnApp[]> | null = null;

function normalizeCdnApp(raw: unknown, kind: MiniAppBundleKind): MiniAppCdnApp | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const slug = trimmed(entry.slug);
  const entryUrl = trimmed(entry.entry_url);
  if (!slug || !entryUrl) return null;
  return {
    app_id: trimmed(entry.app_id) || `miniapp-${slug}`,
    slug,
    kind,
    name: trimmed(entry.name) || slug,
    ...(trimmed(entry.name_zh) ? { name_zh: trimmed(entry.name_zh) } : {}),
    ...(trimmed(entry.name_ja) ? { name_ja: trimmed(entry.name_ja) } : {}),
    description: trimmed(entry.description),
    ...(trimmed(entry.description_zh) ? { description_zh: trimmed(entry.description_zh) } : {}),
    ...(trimmed(entry.description_ja) ? { description_ja: trimmed(entry.description_ja) } : {}),
    category: trimmed(entry.category) || "utility",
    tags: Array.isArray(entry.tags) ? entry.tags.map(trimmed).filter(Boolean) : [],
    version: trimmed(entry.version) || "1.0.0",
    icon_url: trimmed(entry.icon_url),
    banner_url: trimmed(entry.banner_url),
    entry_url: entryUrl,
    manifest_url: trimmed(entry.manifest_url),
    supported_networks: Array.isArray(entry.supported_networks)
      ? entry.supported_networks.map(trimmed).filter(Boolean)
      : [],
    default_network: trimmed(entry.default_network),
    contracts:
      entry.contracts && typeof entry.contracts === "object" && !Array.isArray(entry.contracts)
        ? (entry.contracts as Record<string, unknown>)
        : {},
    ...(entry.onegate && typeof entry.onegate === "object"
      ? { onegate: entry.onegate as Record<string, unknown> }
      : {}),
  };
}

/**
 * Both catalogues, merged and cached for 60s to match the pointer TTL. A kind
 * whose catalogue fails to load is simply absent rather than fatal, so a
 * publish that is mid-flight cannot blank the launcher.
 */
export async function loadMiniAppCdnCatalog(): Promise<MiniAppCdnApp[]> {
  if (!isMiniAppCdnEnabled()) return [];
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_CACHE_TTL_MS) {
    return catalogCache.apps;
  }
  if (catalogInFlight) return catalogInFlight;

  catalogInFlight = (async () => {
    const results = await Promise.all(
      MINIAPP_BUNDLE_KINDS.map(async (kind) => {
        const catalog = await fetchJson<MiniAppCdnCatalog>(buildMiniAppCatalogUrl(kind));
        if (!catalog || !Array.isArray(catalog.apps)) return [];
        return catalog.apps
          .map((app) => normalizeCdnApp(app, kind))
          .filter((app): app is MiniAppCdnApp => app !== null);
      }),
    );
    return results.flat().sort((left, right) => left.slug.localeCompare(right.slug));
  })();

  try {
    const apps = await catalogInFlight;
    // Only cache a non-empty result; caching an empty catalogue would pin the
    // launcher to "no apps" for a full TTL after a transient CDN failure.
    if (apps.length > 0) catalogCache = { at: Date.now(), apps };
    return apps;
  } finally {
    catalogInFlight = null;
  }
}

export function clearMiniAppCdnCatalogCache(): void {
  catalogCache = null;
  catalogInFlight = null;
}

function matchesApp(entry: MiniAppCdnApp, needle: string): boolean {
  const value = needle.toLowerCase();
  return (
    entry.slug.toLowerCase() === value ||
    entry.app_id.toLowerCase() === value ||
    entry.app_id.toLowerCase() === `miniapp-${value}`
  );
}

export async function findMiniAppCdnApp(slugOrAppId: string): Promise<MiniAppCdnApp | null> {
  const needle = trimmed(slugOrAppId);
  if (!needle) return null;
  const catalog = await loadMiniAppCdnCatalog();
  return catalog.find((entry) => matchesApp(entry, needle)) || null;
}

/**
 * Release pointer for one app. The catalogue already carries an entry URL, so
 * this is only needed when a caller wants the pointer's own metadata (version,
 * size, publish time) or when an app is newer than the cached catalogue.
 */
export async function fetchMiniAppBundlePointer(
  slug: string,
  kind?: MiniAppBundleKind,
): Promise<MiniAppBundlePointer | null> {
  if (!isMiniAppCdnEnabled()) return null;
  const kinds = kind ? [kind] : MINIAPP_BUNDLE_KINDS;
  for (const candidate of kinds) {
    const pointer = await fetchJson<MiniAppBundlePointer>(buildMiniAppPointerUrl(candidate, slug));
    if (pointer && trimmed(pointer.entry_url)) return { ...pointer, kind: candidate };
  }
  return null;
}

export type ResolvedMiniAppBundle = {
  entry_url: string;
  source: "cdn" | "local";
  kind: MiniAppBundleKind | null;
  version: string | null;
  base_url: string | null;
};

/**
 * The entry the host should frame for an app, preferring the CDN and degrading
 * to the platform-served copy so local development and the E2E suite keep
 * working without network access.
 */
export async function resolveMiniAppBundle(slug: string): Promise<ResolvedMiniAppBundle> {
  const normalizedSlug = trimmed(slug);
  const local: ResolvedMiniAppBundle = {
    entry_url: buildLocalBundleEntryUrl(normalizedSlug),
    source: "local",
    kind: null,
    version: null,
    base_url: null,
  };
  if (!normalizedSlug || !isMiniAppCdnEnabled()) return local;

  const entry = await findMiniAppCdnApp(normalizedSlug);
  if (entry) {
    return {
      entry_url: entry.entry_url,
      source: "cdn",
      kind: entry.kind,
      version: entry.version,
      base_url: entry.entry_url.replace(/\/index\.html$/, ""),
    };
  }

  const pointer = await fetchMiniAppBundlePointer(normalizedSlug);
  if (pointer) {
    return {
      entry_url: pointer.entry_url,
      source: "cdn",
      kind: pointer.kind,
      version: pointer.version,
      base_url: pointer.base_url,
    };
  }

  return local;
}

/**
 * A CDN catalogue entry rendered in the shape `coerceMiniAppInfo` accepts.
 *
 * This is what keeps the host working once apps/ is gone from this repo: the
 * definition that used to be read from apps/<slug>/neo-manifest.json is now
 * assembled from the published catalogue instead.
 */
export function buildDefinitionFromCdnApp(entry: MiniAppCdnApp): Record<string, unknown> {
  return {
    app_id: entry.app_id,
    name: entry.name,
    ...(entry.name_zh ? { name_zh: entry.name_zh } : {}),
    ...(entry.name_ja ? { name_ja: entry.name_ja } : {}),
    description: entry.description,
    ...(entry.description_zh ? { description_zh: entry.description_zh } : {}),
    ...(entry.description_ja ? { description_ja: entry.description_ja } : {}),
    category: entry.category,
    status: "active",
    entry_url: entry.entry_url,
    dapp_url: entry.entry_url,
    logo_url: entry.icon_url || undefined,
    banner_url: entry.banner_url || undefined,
    contracts: entry.contracts,
    manifest: {
      id: entry.app_id,
      name: entry.name,
      version: entry.version,
      category: entry.category,
      tags: entry.tags,
      contracts: entry.contracts,
      supported_networks: entry.supported_networks,
      default_network: entry.default_network,
      urls: {
        entry: entry.entry_url,
        icon: entry.icon_url,
        banner: entry.banner_url,
      },
      ...(entry.onegate ? { onegate: entry.onegate } : {}),
    },
    bundle: {
      kind: entry.kind,
      version: entry.version,
      source: "cdn",
      entry_url: entry.entry_url,
      manifest_url: entry.manifest_url,
    },
  };
}
