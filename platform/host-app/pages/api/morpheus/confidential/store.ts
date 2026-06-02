import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import { resolveMorpheusPublicApiCandidates } from "@/lib/morpheus-endpoints";

const MORPHEUS_CONFIDENTIAL_TIMEOUT_MS = 10_000;

function resolveMorpheusPublicApiUrl(networkInput?: string | null) {
  // Confidential store still lives behind the web gateway `/api/confidential/store`.
  const candidates = resolveMorpheusPublicApiCandidates(networkInput);
  return (candidates[0] || "").replace(/\/$/, "");
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function upstreamErrorMessage(status: number, text: string) {
  const parsed = tryParseJson(text);
  const message =
    parsed?.error || parsed?.message || parsed?.detail || text.trim();
  return String(message || `Morpheus confidential store returned ${status}`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;
  if (String(req.method || "").toUpperCase() !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const network =
    String(req.body?.network || req.body?.morpheus_network || "").trim() ||
    "testnet";
  const baseUrl = resolveMorpheusPublicApiUrl(network);
  if (!baseUrl) {
    return apiError.configError(
      res,
      "Morpheus public API URL is not configured",
    );
  }

  const body = req.body || {};
  const ciphertext = String(body.ciphertext || "").trim();
  if (!ciphertext) {
    return apiError.badRequest(res, "ciphertext is required");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    MORPHEUS_CONFIDENTIAL_TIMEOUT_MS,
  );

  try {
    const upstream = await fetch(`${baseUrl}/api/confidential/store`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    res.setHeader("Cache-Control", "no-store, private");
    const text = await upstream.text();
    const upstreamOk =
      upstream.ok ?? (upstream.status >= 200 && upstream.status < 300);
    if (!upstreamOk) {
      res.status(200).json({
        status: "inline_fallback",
        inline_fallback: true,
        store_available: false,
        upstream_status: upstream.status,
        error: upstreamErrorMessage(upstream.status, text),
      });
      return;
    }

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json",
    );
    res.send(text);
    return;
  } catch (error) {
    if (controller.signal.aborted) {
      return apiError.gatewayTimeout(
        res,
        "Morpheus confidential store timed out",
      );
    }
    return apiError.gatewayError(
      res,
      error instanceof Error
        ? error.message
        : "Morpheus confidential store failed",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
