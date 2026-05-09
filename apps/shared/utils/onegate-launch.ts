const DEFAULT_ONEGATE_APP_BASE_URL = "https://onegate.space/app";
const DEFAULT_MINIAPP_ORIGIN = "https://neomini.app";
const SAFE_PARAM_KEY = /^[a-zA-Z0-9_.:-]+$/;
const SAFE_MINIAPP_SLUG = /^[a-zA-Z0-9_-]+$/;

type LaunchParamValue = string | number | boolean | null | undefined;

export type OneGateLaunchParams = Record<string, LaunchParamValue>;

function safeString(value: LaunchParamValue): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 512);
}

function safeParamKey(value: string): string {
  const key = safeString(value).slice(0, 64);
  return SAFE_PARAM_KEY.test(key) ? key : "";
}

function normalizeOneGateBaseUrl(value?: string): string {
  const raw = safeString(value).replace(/\/+$/, "");
  if (!raw) return DEFAULT_ONEGATE_APP_BASE_URL;
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_ONEGATE_APP_BASE_URL;
  }
}

function normalizeOneGateDappId(value: LaunchParamValue): string {
  const raw = safeString(value).slice(0, 32);
  return /^[A-Za-z0-9_.:-]+$/.test(raw) ? raw : "";
}

function normalizeMiniAppOrigin(value?: string): string {
  const raw = safeString(value).replace(/\/+$/, "");
  if (!raw) return DEFAULT_MINIAPP_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_MINIAPP_ORIGIN;
  }
}

export function stableOneGateDappId(appId: string): number {
  const normalized = safeString(appId);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 1) || 1;
}

export function buildOneGateLaunchUrl(
  appId: string,
  params: OneGateLaunchParams = {},
  options: { baseUrl?: string; dappId?: string | number } = {},
): string {
  const normalizedAppId = safeString(appId);
  const baseUrl = normalizeOneGateBaseUrl(options.baseUrl);
  const oneGateDappId =
    normalizeOneGateDappId(options.dappId) ||
    String(stableOneGateDappId(normalizedAppId));
  const url = new URL(`${baseUrl}/${oneGateDappId}`);
  url.searchParams.set("source", "onegate");
  if (normalizedAppId) url.searchParams.set("appId", normalizedAppId);

  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = safeParamKey(rawKey);
    const value = safeString(rawValue);
    if (!key || !value) continue;
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function buildOneGateDirectMiniAppUrl(
  slug: string,
  appId: string,
  params: OneGateLaunchParams = {},
  options: { origin?: string } = {},
): string {
  const safeSlug = safeString(slug).slice(0, 96);
  const normalizedSlug = SAFE_MINIAPP_SLUG.test(safeSlug) ? safeSlug : "";
  const normalizedAppId = safeString(appId);
  const origin = normalizeMiniAppOrigin(options.origin);
  const url = new URL(
    `/miniapps/${normalizedSlug || normalizedAppId || "miniapp"}/index.html`,
    origin,
  );
  url.searchParams.set("source", "onegate");
  if (normalizedAppId) url.searchParams.set("appId", normalizedAppId);

  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = safeParamKey(rawKey);
    const value = safeString(rawValue);
    if (!key || !value) continue;
    url.searchParams.set(key, value);
  }

  return url.toString();
}
