import type { NextApiRequest } from "next";

const DEFAULT_FETCH_TIMEOUT_MS = 5000; // 5 seconds for SSR
function parseAllowlist(raw: string): { allowAll: boolean; entries: Set<string> } {
  if (!raw) return { allowAll: false, entries: new Set() };
  const tokens = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowAll = tokens.includes("*");
  return { allowAll, entries: new Set(tokens) };
}

export function getEdgeFunctionsBaseUrl(): string {
  const raw = String(process.env.EDGE_BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!raw) return "";
  const base = raw.replace(/\/$/, "");
  if (base.endsWith("/functions/v1")) return base;
  return `${base}/functions/v1`;
}

/**
 * Fetch with timeout for server-side rendering
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildEdgeUrl(fn: string, query: NextApiRequest["query"]): URL | null {
  const base = getEdgeFunctionsBaseUrl();
  if (!base) return null;

  let url: URL;
  try {
    url = new URL(`${base}/${encodeURIComponent(fn)}`);
  } catch (_e: unknown) {
    console.warn("[edge] URL construction failed:", _e instanceof Error ? _e.message : String(_e));
    return null;
  }
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, "");
}

function joinHeaderValues(value: string | string[]): string {
  const raw = Array.isArray(value) ? value.join(",") : value;
  return sanitizeHeaderValue(raw);
}

export function forwardAuthHeaders(req: NextApiRequest): Headers {
  const headers = new Headers();
  const auth = req.headers.authorization;
  if (auth) headers.set("Authorization", joinHeaderValues(auth));
  const apiKey = req.headers["x-api-key"];
  if (apiKey) headers.set("X-API-Key", joinHeaderValues(apiKey));
  return headers;
}

export function forwardEdgeRpcHeaders(req: NextApiRequest): Headers {
  const headers = forwardAuthHeaders(req);
  const contentType = req.headers["content-type"];
  if (contentType) headers.set("Content-Type", joinHeaderValues(contentType));
  const accept = req.headers["accept"];
  if (accept) headers.set("Accept", joinHeaderValues(accept));
  return headers;
}

export function isEdgeRpcAllowed(fn: string): boolean {
  const edgeRPCAllowlist = String(process.env.EDGE_RPC_ALLOWLIST || "").trim();
  const { allowAll, entries } = parseAllowlist(edgeRPCAllowlist);
  if (allowAll) return true;
  if (entries.size === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return entries.has(fn);
}

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

function normalizeBaseUrl(raw: string): string | null {
  const value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-zA-Z0-9._-]+(:\d+)?$/.test(value)) return `https://${value}`;
  return null;
}

function fromHeaderValue(value?: string | string[]): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function isLocalhostHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Resolve the base URL for internal API calls during SSR.
 * Priority: NEXT_PUBLIC_API_URL env > Vercel runtime URL > request host header > error
 */
export function resolveInternalBaseUrl(req?: RequestLike): string {
  const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL || "");
  if (envBase) return envBase;

  const vercelBase = normalizeBaseUrl(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      || process.env.VERCEL_BRANCH_URL
      || process.env.VERCEL_URL
      || "",
  );
  if (vercelBase) return vercelBase;

  const rawForwardedHost = fromHeaderValue(req?.headers?.["x-forwarded-host"]);
  const rawHost = rawForwardedHost || fromHeaderValue(req?.headers?.host);
  if (rawHost && /^[a-zA-Z0-9._-]+(:\d+)?$/.test(rawHost)) {
    const rawProto = fromHeaderValue(req?.headers?.["x-forwarded-proto"]);
    const proto = rawProto === "https" || (process.env.NODE_ENV === "production" && !rawProto && !isLocalhostHost(rawHost))
      ? "https"
      : "http";
    return `${proto}://${rawHost}`;
  }

  throw new Error(
    "Unable to resolve base URL: set NEXT_PUBLIC_API_URL, or provide VERCEL_URL / valid host headers",
  );
}
