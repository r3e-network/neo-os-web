import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MAX_BODY_SIZE = 256 * 1024;
const AA_RELAY_TIMEOUT_MS = 10_000;
const AA_RELAY_CORS_ALLOW_METHODS = "POST,OPTIONS";
const AA_RELAY_CORS_ALLOW_HEADERS =
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

function applyAaRelayCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = resolveCorsOrigin(req);
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", AA_RELAY_CORS_ALLOW_METHODS);
  res.setHeader("Access-Control-Allow-Headers", AA_RELAY_CORS_ALLOW_HEADERS);
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += buffer.length;
      if (totalSize > MAX_BODY_SIZE) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve());
    req.on("error", reject);
  });

  return Buffer.concat(chunks);
}

function resolveRelayUrl(): string {
  const value = String(
    process.env.AA_RELAY_URL || process.env.NEXT_PUBLIC_AA_RELAY_URL || "",
  ).trim();
  return value.replace(/\/$/, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  applyAaRelayCors(req, res);

  if (String(req.method || "").toUpperCase() === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (standardLimit(req, res)) return;

  if (String(req.method || "").toUpperCase() !== "POST") {
    apiError.badRequest(res, "POST required");
    return;
  }

  const relayUrl = resolveRelayUrl();
  if (!relayUrl) {
    apiError.internal(
      res,
      "AA_RELAY_URL (or NEXT_PUBLIC_AA_RELAY_URL) not configured",
    );
    return;
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    apiError.badRequest(
      res,
      error instanceof Error ? error.message : "invalid request body",
    );
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AA_RELAY_TIMEOUT_MS);

  try {
    const upstream = await fetch(relayUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": String(
          req.headers["content-type"] || "application/json",
        ),
      },
      body: new Uint8Array(rawBody),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json",
    );
    res.send(text);
    return;
  } catch (error) {
    logger.error(
      "AA relay proxy error:",
      error instanceof Error ? error.message : "unknown error",
    );
    if (controller.signal.aborted) {
      apiError.gatewayError(res, "AA relay timed out");
      return;
    }
    return apiError.gatewayError(res, "AA relay request failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

export const config = {
  api: { bodyParser: false },
};
