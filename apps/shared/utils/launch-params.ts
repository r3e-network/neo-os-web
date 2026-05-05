export type MiniAppLaunchNetwork = "mainnet" | "testnet";

export type MiniAppLaunchContext = {
  appId: string | null;
  source: string;
  operation: string | null;
  tab: string | null;
  network: MiniAppLaunchNetwork | null;
  params: Record<string, string>;
  keys: string[];
  hasParams: boolean;
  signature: string;
};

const EMPTY_CONTEXT: MiniAppLaunchContext = {
  appId: null,
  source: "url",
  operation: null,
  tab: null,
  network: null,
  params: {},
  keys: [],
  hasParams: false,
  signature: "",
};

const METADATA_KEYS = new Set([
  "app",
  "appid",
  "app_id",
  "miniappid",
  "miniapp_id",
  "miniapp",
  "source",
  "operation",
  "op",
  "action",
  "tab",
  "network",
  "chain",
  "launchparams",
  "launch_params",
  "onegate_params",
  "payload",
  "params",
  "returnurl",
  "return_url",
  "callbackurl",
  "callback_url",
]);

function safeString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 512);
}

function safeKey(value: unknown): string {
  const key = safeString(value).slice(0, 64);
  if (!/^[a-zA-Z0-9_.:-]+$/.test(key)) return "";
  return key;
}

function metadataKey(value: string): string {
  return value.replace(/[-_.:]/g, "").toLowerCase();
}

function normalizeBusinessKey(rawKey: string): string {
  const key = safeKey(rawKey);
  if (!key) return "";

  const namespaced = key.match(/^(?:param|params|launch)\.([a-zA-Z0-9_.:-]+)$/);
  if (namespaced) return safeKey(namespaced[1]);

  const bracketed = key.match(/^params\[([a-zA-Z0-9_.:-]+)\]$/);
  if (bracketed) return safeKey(bracketed[1]);

  if (metadataKey(key).startsWith("utm")) return "";
  if (METADATA_KEYS.has(metadataKey(key))) return "";
  return key;
}

function firstValue(params: URLSearchParams, keys: string[]): string {
  for (const key of keys) {
    const value = safeString(params.get(key));
    if (value) return value;
  }
  return "";
}

function normalizeNetwork(value: string): MiniAppLaunchNetwork | null {
  const raw = value.toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

function maybeDecodeJson(raw: string): unknown {
  if (!raw) return null;

  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* ignore */
  }

  if (/^[A-Za-z0-9_-]+={0,2}$/.test(raw) && raw.length >= 4) {
    try {
      const padded = raw.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(raw.length / 4) * 4, "=");
      candidates.push(atob(padded));
    } catch {
      /* ignore */
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function collectParams(source: Record<string, unknown>, target: Record<string, string>) {
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeBusinessKey(rawKey);
    const value = safeString(rawValue);
    if (!key || !value) continue;
    target[key] = value;
  }
}

function collectPayload(params: URLSearchParams, target: Record<string, string>): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const key of ["launchParams", "launch_params", "onegate_params", "payload", "params"]) {
    const raw = safeString(params.get(key));
    if (!raw) continue;
    const decoded = asRecord(maybeDecodeJson(raw));
    for (const [metaKey, aliases] of Object.entries({
      appId: ["appId", "app_id", "app", "miniAppId", "miniapp_id"],
      operation: ["operation", "op", "action"],
      tab: ["tab"],
      network: ["network", "chain"],
      source: ["source"],
    })) {
      const value = aliases.map((alias) => safeString(decoded[alias])).find(Boolean);
      if (value && !meta[metaKey]) meta[metaKey] = value;
    }
    const nested = asRecord(decoded.params);
    collectParams(nested, target);
    collectParams(decoded, target);
  }
  return meta;
}

function collectSearchParams(params: URLSearchParams, target: Record<string, string>) {
  params.forEach((value, rawKey) => {
    const key = normalizeBusinessKey(rawKey);
    const normalizedValue = safeString(value);
    if (!key || !normalizedValue) return;
    target[key] = normalizedValue;
  });
}

function getUrl(input?: string | URL | null): URL | null {
  if (input instanceof URL) return input;
  if (typeof input === "string" && input.trim()) {
    try {
      return new URL(input, "https://neomini.app");
    } catch {
      return null;
    }
  }
  if (typeof window === "undefined") return null;
  try {
    return new URL(window.location.href);
  } catch {
    return null;
  }
}

function getHashParams(url: URL): URLSearchParams {
  const hash = url.hash || "";
  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(queryIndex + 1));
}

function buildSignature(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key] ?? "")}`)
    .join("&");
}

export function parseMiniAppLaunchContext(
  input?: string | URL | null,
  fallbackAppId?: string | null,
): MiniAppLaunchContext {
  const url = getUrl(input);
  if (!url) return { ...EMPTY_CONTEXT };

  const hashParams = getHashParams(url);
  const params: Record<string, string> = {};
  const searchMeta = collectPayload(url.searchParams, params);
  const hashMeta = collectPayload(hashParams, params);
  collectSearchParams(url.searchParams, params);
  collectSearchParams(hashParams, params);

  const appId =
    firstValue(url.searchParams, ["appId", "app_id", "app", "miniAppId", "miniapp_id"]) ||
    firstValue(hashParams, ["appId", "app_id", "app", "miniAppId", "miniapp_id"]) ||
    safeString(searchMeta.appId) ||
    safeString(hashMeta.appId) ||
    safeString(fallbackAppId) ||
    null;
  const operation =
    firstValue(url.searchParams, ["operation", "op", "action"]) ||
    firstValue(hashParams, ["operation", "op", "action"]) ||
    safeString(searchMeta.operation) ||
    safeString(hashMeta.operation) ||
    null;
  const tab =
    firstValue(url.searchParams, ["tab"]) ||
    firstValue(hashParams, ["tab"]) ||
    safeString(searchMeta.tab) ||
    safeString(hashMeta.tab) ||
    null;
  const network = normalizeNetwork(
    firstValue(url.searchParams, ["network", "chain"]) ||
      firstValue(hashParams, ["network", "chain"]) ||
      safeString(searchMeta.network) ||
      safeString(hashMeta.network),
  );
  const source =
    firstValue(url.searchParams, ["source"]) ||
    firstValue(hashParams, ["source"]) ||
    safeString(searchMeta.source) ||
    safeString(hashMeta.source) ||
    (url.searchParams.has("onegate_params") || hashParams.has("onegate_params") ? "onegate" : "url");
  const signature = buildSignature(params);
  const keys = Object.keys(params).sort();

  return {
    appId,
    source: source.toLowerCase() === "onegate" ? "onegate" : source || "url",
    operation,
    tab,
    network,
    params,
    keys,
    hasParams: keys.length > 0,
    signature,
  };
}

export function readMiniAppLaunchContext(appId?: string | null): MiniAppLaunchContext {
  return parseMiniAppLaunchContext(null, appId);
}

export function getLaunchParam(
  context: Pick<MiniAppLaunchContext, "params"> | null | undefined,
  keys: string | string[],
  fallback = "",
): string {
  const aliases = Array.isArray(keys) ? keys : [keys];
  const params = context?.params ?? {};
  for (const key of aliases) {
    const value = safeString(params[key]);
    if (value) return value;
  }
  return fallback;
}
