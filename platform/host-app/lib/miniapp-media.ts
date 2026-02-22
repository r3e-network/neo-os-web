import type { MiniAppInfo } from "../components/types";

type MediaOptions = {
  appID?: string | null;
  entryURL?: string | null;
  logoURL?: string | null;
  bannerURL?: string | null;
};

const miniAppPathPattern = /\/(?:miniapps|miniapp-assets)\/([^/?#]+)/i;
const imageExtensions = ["jpg", "png", "jpeg", "svg"] as const;
type AssetKind = "logo" | "banner";

function toNonEmptyString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function unique(items: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const value = toNonEmptyString(item);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizeSlug(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function resolveMiniAppSlug(appID?: string | null, entryURL?: string | null): string {
  const url = toNonEmptyString(entryURL);
  if (url) {
    const match = url.match(miniAppPathPattern);
    if (match && match[1]) {
      return normalizeSlug(decodeURIComponent(match[1]));
    }
  }

  const id = toNonEmptyString(appID);
  if (!id) return "";
  return normalizeSlug(id.replace(/^miniapp-/, ""));
}

export function getMiniAppPrimaryAssets(appID?: string | null, entryURL?: string | null): {
  logoURL: string | null;
  bannerURL: string | null;
} {
  const slug = resolveMiniAppSlug(appID, entryURL);
  if (!slug) return { logoURL: null, bannerURL: null };

  return {
    // Prefer main branch convention (JPG under miniapp-assets).
    logoURL: `/miniapp-assets/${slug}/logo.jpg`,
    bannerURL: `/miniapp-assets/${slug}/banner.jpg`,
  };
}

function getMiniAppAssetCandidates(asset: AssetKind, appID?: string | null, entryURL?: string | null): string[] {
  const slug = resolveMiniAppSlug(appID, entryURL);
  if (!slug) return [];

  const bases = [
    `/miniapp-assets/${slug}/${asset}`,
    `/miniapps/${slug}/${asset}`,
    // Keep compatibility with source-tree style paths used by miniapp folders.
    `/miniapps/${slug}/public/${asset}`,
  ];

  const out: string[] = [];
  for (const base of bases) {
    for (const ext of imageExtensions) {
      out.push(`${base}.${ext}`);
    }
  }
  return out;
}

export function buildMiniAppLogoSources(options: MediaOptions): string[] {
  const primary = getMiniAppPrimaryAssets(options.appID, options.entryURL);
  return unique([
    options.logoURL,
    primary.logoURL,
    ...getMiniAppAssetCandidates("logo", options.appID, options.entryURL),
  ]);
}

export function buildMiniAppBannerSources(options: MediaOptions): string[] {
  const primary = getMiniAppPrimaryAssets(options.appID, options.entryURL);
  return unique([
    options.bannerURL,
    primary.bannerURL,
    ...getMiniAppAssetCandidates("banner", options.appID, options.entryURL),
  ]);
}

export function withMiniAppCardAssets<T extends Pick<MiniAppInfo, "app_id" | "entry_url"> & Partial<MiniAppInfo>>(
  app: T,
): T & Pick<MiniAppInfo, "logo_url" | "banner_url"> {
  const primary = getMiniAppPrimaryAssets(app.app_id, app.entry_url);
  return {
    ...app,
    logo_url: toNonEmptyString(app.logo_url) || primary.logoURL,
    banner_url: toNonEmptyString(app.banner_url) || primary.bannerURL,
  };
}
