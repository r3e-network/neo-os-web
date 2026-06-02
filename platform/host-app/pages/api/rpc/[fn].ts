import type { NextApiRequest, NextApiResponse } from "next";
import {
  forwardEdgeRpcHeaders,
  getEdgeFunctionsBaseUrl,
  isEdgeRpcAllowed,
} from "../../../lib/edge";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 0;
const RETRY_DELAY_MS = 1000;
const RPC_CORS_ALLOW_METHODS = "GET,HEAD,POST,OPTIONS";
const RPC_CORS_ALLOW_HEADERS =
  "Content-Type, Authorization, X-API-Key, X-Requested-With";

function resolveCorsOrigin(req: NextApiRequest): string | null {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return null;
  if (origin === "null") return "null";

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!host) return null;

  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === host ? origin : null;
  } catch {
    return null;
  }
}

function applyRpcCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = resolveCorsOrigin(req);
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", RPC_CORS_ALLOW_METHODS);
  res.setHeader("Access-Control-Allow-Headers", RPC_CORS_ALLOW_HEADERS);
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number,
): Promise<Response> {
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

  throw lastError
    ? new Error(
        `fetchWithRetry(${url}) failed after ${maxRetries} retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      )
    : new Error(
        `fetchWithRetry(${url}) failed after ${maxRetries} retries: unknown error`,
      );
}

const MAX_BODY_SIZE = 256 * 1024; // 256 KB
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2 MB
const EDGE_BASE_UNCONFIGURED =
  "EDGE_BASE_URL (or NEXT_PUBLIC_EDGE_URL / NEXT_PUBLIC_SUPABASE_URL) not configured";

function sendLocalSponsorUnavailable(
  fn: string,
  res: NextApiResponse,
): boolean {
  if (fn === "gas-sponsor-check") {
    res.status(200).json({
      eligible: false,
      gas_balance: "0",
      daily_limit: "0",
      used_today: "0",
      remaining: "0",
      resets_at: "",
      status: "unavailable",
      reason: EDGE_BASE_UNCONFIGURED,
    });
    return true;
  }
  if (fn === "gas-sponsor-request") {
    res.status(200).json({
      request_id: "",
      amount: "",
      status: "unavailable",
      tx_hash: null,
      reason: EDGE_BASE_UNCONFIGURED,
    });
    return true;
  }
  return false;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;
  applyRpcCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

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
    if (sendLocalSponsorUnavailable(fn, res)) return;
    apiError.internal(res, EDGE_BASE_UNCONFIGURED);
    return;
  }

  let url: URL;
  try {
    url = new URL(`${base}/${encodeURIComponent(fn)}`);
  } catch {
    apiError.internal(res, "Invalid EDGE_BASE_URL configuration");
    return;
  }

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
    const upstream = await fetchWithRetry(
      url.toString(),
      { method, headers, body },
      MAX_RETRIES,
    );

    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store, private");
    const blockedHeaders = new Set([
      "transfer-encoding",
      "connection",
      "set-cookie",
      "access-control-allow-origin",
      "cache-control",
      "vary",
    ]);
    upstream.headers.forEach((value, key) => {
      if (blockedHeaders.has(key)) return;
      res.setHeader(key, value);
    });

    const contentLength = parseInt(
      upstream.headers.get("content-length") || "0",
      10,
    );
    if (contentLength > MAX_RESPONSE_SIZE) {
      return apiError.gatewayError(res, "upstream response too large");
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_RESPONSE_SIZE) {
      return apiError.gatewayError(res, "upstream response too large");
    }
    res.send(buf);
    return;
  } catch (err) {
    logger.error(
      "RPC upstream error:",
      err instanceof Error ? err.message : "unknown error",
    );
    return apiError.gatewayTimeout(res, "Upstream request failed");
  }
}

export const config = {
  api: { bodyParser: false },
};
