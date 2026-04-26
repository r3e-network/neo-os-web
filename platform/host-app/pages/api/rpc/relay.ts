import type { NextApiRequest, NextApiResponse } from "next";
import {
  forwardEdgeRpcHeaders,
  getEdgeFunctionsBaseUrl,
  isEdgeRpcAllowed,
} from "../../../lib/edge";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/** Parsed JSON body with optional function name fields */
interface RPCJsonBody {
  fn?: string;
  function?: string;
  name?: string;
  [key: string]: unknown;
}

const MAX_BODY_SIZE = 256 * 1024; // 256 KB
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2 MB

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

function extractFnFromJsonBody(
  rawBody: Buffer | undefined,
  contentType: string,
) {
  if (!rawBody || !contentType.toLowerCase().includes("application/json"))
    return null;
  try {
    const parsed: RPCJsonBody = JSON.parse(rawBody.toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const fn = String(parsed.fn ?? parsed.function ?? parsed.name ?? "").trim();
    if (!fn) return null;
    delete parsed.fn;
    delete parsed.function;
    delete parsed.name;
    const nextBody = JSON.stringify(parsed);
    return { fn, body: new Uint8Array(Buffer.from(nextBody)) };
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;

  let fn = String(req.query.fn ?? "").trim();
  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    apiError.internal(
      res,
      "EDGE_BASE_URL (or NEXT_PUBLIC_SUPABASE_URL) not configured",
    );
    return;
  }

  const method = String(req.method || "GET").toUpperCase();
  const hasBody = !(method === "GET" || method === "HEAD");
  const rawBody = hasBody ? await readRawBody(req) : undefined;
  const contentType = String(req.headers["content-type"] ?? "");
  let body = rawBody ? new Uint8Array(rawBody) : undefined;

  if (!fn && rawBody) {
    const extracted = extractFnFromJsonBody(rawBody, contentType);
    if (extracted) {
      fn = extracted.fn;
      body = extracted.body;
    }
  }

  if (!fn) {
    apiError.badRequest(res, "function name required");
    return;
  }
  if (!isEdgeRpcAllowed(fn)) {
    apiError.forbidden(res, "function not allowed");
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const upstream = await fetch(url.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store, private");
    const blockedHeaders = new Set([
      "transfer-encoding",
      "connection",
      "set-cookie",
      "access-control-allow-origin",
      "cache-control",
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
      "RPC relay error:",
      err instanceof Error ? err.message : "unknown error",
    );
    if (controller.signal.aborted) {
      return apiError.gatewayError(res, "upstream request timed out");
    } else {
      return apiError.gatewayError(res, "upstream request failed");
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export const config = {
  api: { bodyParser: false },
};
