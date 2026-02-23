import type { MiniAppInfo } from "../components/types";

type MediaTheme = "light" | "dark" | "any";
type MediaDensity = "1x" | "2x" | "3x";

type MediaPreferences = {
  theme?: MediaTheme;
  density?: MediaDensity;
  locale?: string | null;
};

type MediaOptions = {
  appID?: string | null;
  entryURL?: string | null;
  logoURL?: string | null;
  bannerURL?: string | null;
  manifest?: Record<string, unknown> | null;
  preferences?: MediaPreferences;
};

const miniAppPathPattern = /\/(?:miniapps|miniapp-assets)\/([^/?#]+)/i;
const imageExtensions = ["jpg", "png", "jpeg", "svg"] as const;
type AssetKind = "logo" | "banner";

type MediaVariant = {
  url: string;
  theme?: MediaTheme;
  density?: MediaDensity;
  locale?: string;
};

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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeTheme(value: unknown): MediaTheme | undefined {
  const raw = toNonEmptyString(value).toLowerCase();
  if (raw === "light" || raw === "dark" || raw === "any") return raw;
  return undefined;
}

function normalizeDensity(value: unknown): MediaDensity | undefined {
  const raw = toNonEmptyString(value).toLowerCase();
  if (raw === "1x" || raw === "2x" || raw === "3x") return raw;
  return undefined;
}

function normalizeLocale(value: unknown): string | undefined {
  const raw = toNonEmptyString(value);
  if (!raw) return undefined;
  return raw.toLowerCase();
}

function readEnvThemePreference(): MediaTheme {
  if (typeof window === "undefined") return "any";
  const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? "dark" : "light";
}

function readEnvDensityPreference(): MediaDensity {
  if (typeof window === "undefined") return "1x";
  const ratio = typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;
  if (ratio >= 2.75) return "3x";
  if (ratio >= 1.5) return "2x";
  return "1x";
}

function readEnvLocalePreference(): string {
  if (typeof navigator === "undefined") return "";
  return normalizeLocale(navigator.language) || "";
}

function normalizePreferences(preferences: MediaPreferences | undefined): {
  theme: MediaTheme;
  density: MediaDensity;
  locale: string;
} {
  const theme =
    preferences?.theme === "dark"
      ? "dark"
      : preferences?.theme === "light"
        ? "light"
        : readEnvThemePreference();
  const density =
    preferences?.density === "3x"
      ? "3x"
      : preferences?.density === "2x"
        ? "2x"
        : preferences?.density === "1x"
          ? "1x"
          : readEnvDensityPreference();
  const locale = normalizeLocale(preferences?.locale) || readEnvLocalePreference();
  return { theme, density, locale };
}

function parseVariant(raw: unknown): MediaVariant | null {
  const obj = asObject(raw);
  const url = toNonEmptyString(obj.url);
  if (!url) return null;

  return {
    url,
    theme: normalizeTheme(obj.theme),
    density: normalizeDensity(obj.density),
    locale: normalizeLocale(obj.locale),
  };
}

function getVariantList(manifest: Record<string, unknown> | null | undefined, kind: AssetKind): MediaVariant[] {
  const manifestObj = asObject(manifest);
  const media = asObject(manifestObj.media);
  const key = kind === "logo" ? "logo_variants" : "banner_variants";
  const camelKey = kind === "logo" ? "logoVariants" : "bannerVariants";
  const list =
    (Array.isArray(media[key]) && media[key]) ||
    (Array.isArray(manifestObj[key]) && manifestObj[key]) ||
    (Array.isArray(media[camelKey]) && media[camelKey]) ||
    (Array.isArray(manifestObj[camelKey]) && manifestObj[camelKey]) ||
    [];
  return list.map(parseVariant).filter((item): item is MediaVariant => Boolean(item));
}

function scoreVariant(variant: MediaVariant, prefs: { theme: MediaTheme; density: MediaDensity; locale: string }): number {
  let score = 0;

  if (variant.theme === prefs.theme) score += 40;
  else if (variant.theme === "any" || !variant.theme || prefs.theme === "any") score += 20;

  if (variant.density === prefs.density) score += 10;
  else if (!variant.density) score += 3;

  if (prefs.locale && variant.locale) {
    if (variant.locale === prefs.locale) {
      score += 30;
    } else {
      const prefsPrefix = prefs.locale.split("-")[0];
      const variantPrefix = variant.locale.split("-")[0];
      if (prefsPrefix && variantPrefix && prefsPrefix === variantPrefix) score += 18;
    }
  } else if (!variant.locale) {
    score += 1;
  }

  return score;
}

function getVariantUrls(
  manifest: Record<string, unknown> | null | undefined,
  kind: AssetKind,
  preferences?: MediaPreferences,
): string[] {
  const variants = getVariantList(manifest, kind);
  if (variants.length === 0) return [];

  const prefs = normalizePreferences(preferences);
  return variants
    .map((variant, index) => ({
      variant,
      index,
      score: scoreVariant(variant, prefs),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((entry) => entry.variant.url);
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
  const variants = getVariantUrls(options.manifest, "logo", options.preferences);
  return unique([
    options.logoURL,
    ...variants,
    primary.logoURL,
    ...getMiniAppAssetCandidates("logo", options.appID, options.entryURL),
  ]);
}

export function buildMiniAppBannerSources(options: MediaOptions): string[] {
  const primary = getMiniAppPrimaryAssets(options.appID, options.entryURL);
  const variants = getVariantUrls(options.manifest, "banner", options.preferences);
  return unique([
    options.bannerURL,
    ...variants,
    primary.bannerURL,
    ...getMiniAppAssetCandidates("banner", options.appID, options.entryURL),
  ]);
}

export function withMiniAppCardAssets<T extends Pick<MiniAppInfo, "app_id" | "entry_url"> & Partial<MiniAppInfo>>(
  app: T,
): T & Pick<MiniAppInfo, "logo_url" | "banner_url"> {
  const logoSources = buildMiniAppLogoSources({
    appID: app.app_id,
    entryURL: app.entry_url,
    logoURL: toNonEmptyString(app.logo_url),
    manifest: app.manifest || null,
  });
  const bannerSources = buildMiniAppBannerSources({
    appID: app.app_id,
    entryURL: app.entry_url,
    bannerURL: toNonEmptyString(app.banner_url),
    manifest: app.manifest || null,
  });

  return {
    ...app,
    logo_url: logoSources[0] || null,
    banner_url: bannerSources[0] || null,
  };
}
