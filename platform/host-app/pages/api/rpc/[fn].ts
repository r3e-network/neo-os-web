import type { NextApiRequest, NextApiResponse } from "next";
import { forwardEdgeRpcHeaders, getEdgeFunctionsBaseUrl, isEdgeRpcAllowed } from "../../../lib/edge";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";

const FETCH_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, FETCH_TIMEOUT_MS);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") {
        lastError = new Error("Request timeout");
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  const fn = String(req.query.fn ?? "").trim();
  if (!fn) {
    apiError.badRequest(res, "function name required");
    return;
  }
  if (!isEdgeRpcAllowed(fn)) {
    apiError.forbidden(res, "function not allowed");
    return;
  }

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    apiError.internal(res, "EDGE_BASE_URL (or NEXT_PUBLIC_SUPABASE_URL) not configured");
    return;
  }

  const url = new URL(`${base}/${encodeURIComponent(fn)}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "fn") continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = forwardEdgeRpcHeaders(req);

  const method = String(req.method || "GET").toUpperCase();
  const hasBody = !(method === "GET" || method === "HEAD");
  const rawBody = hasBody ? await readRawBody(req) : undefined;
  const body = rawBody ? new Uint8Array(rawBody) : undefined;

  try {
    const upstream = await fetchWithRetry(url.toString(), { method, headers, body }, MAX_RETRIES);

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key === "transfer-encoding" || key === "connection") return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error("RPC upstream error:", err);
    apiError.gatewayTimeout(res, "Upstream request failed");
  }
}

export const config = {
  api: { bodyParser: false },
};
