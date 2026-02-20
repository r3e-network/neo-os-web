import type { MiniAppInfo } from "../components/types";

type MediaOptions = {
  appID?: string | null;
  entryURL?: string | null;
  logoURL?: string | null;
  bannerURL?: string | null;
};

const miniAppPathPattern = /\/(?:miniapps|miniapp-assets)\/([^/?#]+)/i;

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

function resolveAssetBases(entryURL?: string | null): string[] {
  const url = toNonEmptyString(entryURL).toLowerCase();
  if (url.includes("/miniapp-assets/")) {
    return ["/miniapp-assets", "/miniapps"];
  }
  if (url.includes("/miniapps/")) {
    return ["/miniapps", "/miniapp-assets"];
  }
  return ["/miniapps", "/miniapp-assets"];
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
    logoURL: `/miniapps/${slug}/logo.png`,
    bannerURL: `/miniapps/${slug}/banner.png`,
  };
}

export function buildMiniAppLogoSources(options: MediaOptions): string[] {
  const slug = resolveMiniAppSlug(options.appID, options.entryURL);
  const primary = getMiniAppPrimaryAssets(options.appID, options.entryURL);
  const bases = resolveAssetBases(options.entryURL);

  return unique([
    options.logoURL,
    primary.logoURL,
    ...(slug ? bases.map((base) => `${base}/${slug}/logo.jpg`) : []),
    ...(slug ? bases.map((base) => `${base}/${slug}/static/logo.png`) : []),
    ...(slug ? bases.map((base) => `${base}/${slug}/static/icon.svg`) : []),
  ]);
}

export function buildMiniAppBannerSources(options: MediaOptions): string[] {
  const slug = resolveMiniAppSlug(options.appID, options.entryURL);
  const primary = getMiniAppPrimaryAssets(options.appID, options.entryURL);
  const bases = resolveAssetBases(options.entryURL);

  return unique([
    options.bannerURL,
    primary.bannerURL,
    ...(slug ? bases.map((base) => `${base}/${slug}/banner.jpg`) : []),
    ...(slug ? bases.map((base) => `${base}/${slug}/static/banner.svg`) : []),
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
