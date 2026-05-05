import type { NextApiRequest, NextApiResponse } from "next";
import { forwardEdgeRpcHeaders, getEdgeFunctionsBaseUrl } from "@/lib/edge";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_SIZE = 256 * 1024;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

function parseAllowlist(raw: string): {
  allowAll: boolean;
  entries: Set<string>;
} {
  const entries = String(raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    allowAll: entries.includes("*"),
    entries: new Set(entries),
  };
}

function isMiniAppEdgeEndpointAllowed(endpoint: string): boolean {
  const { allowAll, entries } = parseAllowlist(
    process.env.MINIAPP_EDGE_ALLOWLIST || "",
  );
  if (allowAll) return true;
  if (entries.size > 0) return entries.has(endpoint);
  return endpoint.startsWith("os-");
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += buf.length;
      if (totalSize > MAX_BODY_SIZE) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return Buffer.concat(chunks);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;

  const endpoint = String(req.query.endpoint || "").trim();
  if (!endpoint) {
    apiError.badRequest(res, "edge endpoint required");
    return;
  }
  if (!isMiniAppEdgeEndpointAllowed(endpoint)) {
    apiError.forbidden(res, "edge endpoint not allowed");
    return;
  }

  const method = String(req.method || "GET").toUpperCase();
  const hasBody = !(method === "GET" || method === "HEAD");
  const rawBody = hasBody ? await readRawBody(req) : undefined;
  const body = rawBody ? new Uint8Array(rawBody) : undefined;
  const headers = forwardEdgeRpcHeaders(req);
  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    apiError.internal(
      res,
      "EDGE_BASE_URL (or NEXT_PUBLIC_EDGE_URL / NEXT_PUBLIC_SUPABASE_URL) not configured",
    );
    return;
  }

  let url: URL;
  try {
    url = new URL(`${base}/${encodeURIComponent(endpoint)}`);
  } catch {
    apiError.internal(res, "Invalid EDGE_BASE_URL configuration");
    return;
  }

  try {
    const upstream = await fetchWithTimeout(url.toString(), {
      method,
      headers,
      body,
    });

    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store, private");
    const blockedHeaders = new Set([
      "transfer-encoding",
      "connection",
      "set-cookie",
      "access-control-allow-origin",
      "cache-control",
      "content-encoding",
      "content-length",
    ]);
    upstream.headers.forEach((value, key) => {
      if (blockedHeaders.has(key)) return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_RESPONSE_SIZE) {
      apiError.gatewayError(res, "upstream response too large");
      return;
    }
    res.send(buf);
  } catch (err) {
    logger.error(
      "MiniApp edge upstream error:",
      err instanceof Error ? err.message : "unknown error",
    );
    apiError.gatewayTimeout(res, "Upstream request failed");
  }
}

export const config = {
  api: { bodyParser: false },
};
