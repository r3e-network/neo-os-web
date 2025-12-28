import type { NextApiRequest } from "next";

const DEFAULT_FETCH_TIMEOUT_MS = 5000; // 5 seconds for SSR
const EDGE_RPC_ALLOWLIST = String(process.env.EDGE_RPC_ALLOWLIST || "").trim();

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

  const url = new URL(`${base}/${encodeURIComponent(fn)}`);
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function forwardAuthHeaders(req: NextApiRequest): Headers {
  const headers = new Headers();
  const auth = req.headers.authorization;
  if (auth) headers.set("Authorization", Array.isArray(auth) ? auth.join(",") : auth);
  const apiKey = req.headers["x-api-key"];
  if (apiKey) headers.set("X-API-Key", Array.isArray(apiKey) ? apiKey.join(",") : apiKey);
  return headers;
}

export function forwardEdgeRpcHeaders(req: NextApiRequest): Headers {
  const headers = forwardAuthHeaders(req);
  const contentType = req.headers["content-type"];
  if (contentType) headers.set("Content-Type", Array.isArray(contentType) ? contentType.join(",") : contentType);
  const accept = req.headers["accept"];
  if (accept) headers.set("Accept", Array.isArray(accept) ? accept.join(",") : accept);
  return headers;
}

export function isEdgeRpcAllowed(fn: string): boolean {
  const { allowAll, entries } = parseAllowlist(EDGE_RPC_ALLOWLIST);
  if (allowAll) return true;
  if (entries.size === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return entries.has(fn);
}

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Resolve the base URL for internal API calls during SSR.
 * Priority: NEXT_PUBLIC_API_URL env > request host header > error
 */
export function resolveInternalBaseUrl(req?: RequestLike): string {
  const envBase = String(process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (envBase) return envBase;

  const host = req?.headers?.host;
  if (host) {
    const protoHeader = req?.headers?.["x-forwarded-proto"];
    const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
    return `${proto || "http"}://${host}`;
  }

  // In production, this should never be reached as host header is always present
  // Throw error instead of silently using localhost
  throw new Error("Unable to resolve base URL: no NEXT_PUBLIC_API_URL env and no host header");
}
