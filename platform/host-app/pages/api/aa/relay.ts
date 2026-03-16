import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MAX_BODY_SIZE = 256 * 1024;

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
  const value = String(process.env.AA_RELAY_URL || process.env.NEXT_PUBLIC_AA_RELAY_URL || "").trim();
  return value.replace(/\/$/, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  if (String(req.method || "").toUpperCase() !== "POST") {
    apiError.badRequest(res, "POST required");
    return;
  }

  const relayUrl = resolveRelayUrl();
  if (!relayUrl) {
    apiError.internal(res, "AA_RELAY_URL (or NEXT_PUBLIC_AA_RELAY_URL) not configured");
    return;
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    apiError.badRequest(res, error instanceof Error ? error.message : "invalid request body");
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const upstream = await fetch(relayUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": String(req.headers["content-type"] || "application/json"),
      },
      body: new Uint8Array(rawBody),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    logger.error("AA relay proxy error:", error instanceof Error ? error.message : "unknown error");
    if (controller.signal.aborted) {
      apiError.gatewayError(res, "AA relay timed out");
      return;
    }
    apiError.gatewayError(res, "AA relay request failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

export const config = {
  api: { bodyParser: false },
};
