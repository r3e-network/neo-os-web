import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { resolveMorpheusPublicApiCandidates } from "@/lib/morpheus-endpoints";
import { strictLimit } from "@/lib/rate-limit";

const REVEAL_PATH = "/oracle/message-reveal";
const REQUEST_TIMEOUT_MS = 12_000;
const ISSUED_AT_TOLERANCE_SECONDS = 10 * 60;
const UINT256_MAX = (1n << 256n) - 1n;

type RevealRequest = {
  chain: "neox";
  messageId: string;
  signature: string;
  issuedAt: number;
};

function parseBody(body: unknown): Record<string, unknown> | null {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

function validateRevealRequest(body: unknown, nowSeconds = Math.floor(Date.now() / 1000)): RevealRequest | null {
  const value = parseBody(body);
  if (!value || value.chain !== "neox") return null;

  const messageId = typeof value.messageId === "string" ? value.messageId.trim() : "";
  if (!/^[1-9]\d*$/.test(messageId)) return null;
  try {
    if (BigInt(messageId) > UINT256_MAX) return null;
  } catch {
    return null;
  }

  const signature = typeof value.signature === "string" ? value.signature.trim() : "";
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return null;

  const issuedAt = value.issuedAt;
  if (!Number.isSafeInteger(issuedAt)) return null;
  if (Math.abs(nowSeconds - Number(issuedAt)) > ISSUED_AT_TOLERANCE_SECONDS) return null;

  return { chain: "neox", messageId, signature, issuedAt: Number(issuedAt) };
}

async function forwardReveal(candidates: string[], payload: RevealRequest) {
  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${candidate.replace(/\/$/, "")}${REVEAL_PATH}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
      const text = await response.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      // A client error is authoritative and should not be replayed to another
      // upstream. Retry only unavailable gateway/server candidates.
      if (response.ok || response.status < 500) {
        return { status: response.status, body };
      }
    } catch {
      // Try the next configured public endpoint.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Cache-Control", "no-store, private");

  const method = String(req.method || "POST").toUpperCase();
  if (method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (method !== "POST") {
    apiError.methodNotAllowed(res);
    return;
  }
  if (strictLimit(req, res)) return;

  const payload = validateRevealRequest(req.body);
  if (!payload) {
    apiError.badRequest(res, "valid Neo X reveal request required");
    return;
  }

  const candidates = resolveMorpheusPublicApiCandidates("mainnet");
  if (candidates.length === 0) {
    apiError.configError(res, "Morpheus public API is not configured");
    return;
  }

  const upstream = await forwardReveal(candidates, payload);
  if (!upstream) {
    apiError.gatewayError(res, "Morpheus message reveal is unavailable");
    return;
  }

  if (upstream.body && typeof upstream.body === "object") {
    res.status(upstream.status).json(upstream.body);
    return;
  }
  if (upstream.status >= 200 && upstream.status < 300) {
    apiError.gatewayError(res, "Morpheus returned an invalid reveal response");
    return;
  }
  res.status(upstream.status).json({ error: "Morpheus rejected the reveal request" });
}
