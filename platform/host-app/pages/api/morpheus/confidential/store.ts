import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import {
  resolveMorpheusConfidentialStoreProjectSlug,
  resolveMorpheusConfidentialStoreToken,
  resolveMorpheusNetwork,
  resolveMorpheusPublicApiCandidates,
} from "@/lib/morpheus-endpoints";

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
  // Standalone MiniApps run in an opaque-origin iframe. JSON POST requests
  // preflight, so the storage lane must expose the same explicit transport
  // contract as the public-key route.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
  res.setHeader("Cache-Control", "no-store, private");

  const method = String(req.method || "").toUpperCase();
  if (method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (standardLimit(req, res)) return;

  const network = resolveMorpheusNetwork(
    String(req.query.network || req.body?.network || req.body?.morpheus_network || "testnet"),
  );
  const baseUrl = resolveMorpheusPublicApiUrl(network);
  const storeToken = resolveMorpheusConfidentialStoreToken(network);
  const projectSlug = resolveMorpheusConfidentialStoreProjectSlug(network);

  if (method === "GET") {
    res.status(200).json({
      available: Boolean(baseUrl && storeToken && projectSlug),
      network,
      target_chain: "neo_n3",
    });
    return;
  }
  if (method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
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
  if (!storeToken || !projectSlug) {
    return apiError.configError(
      res,
      "Morpheus confidential store credentials are not configured",
    );
  }

  const publicEnvelope = body.public_envelope;
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : {};
  const forwardedBody = {
    ...body,
    network,
    target_chain: "neo_n3",
    project_slug: projectSlug,
    ...(publicEnvelope && typeof publicEnvelope === "object" && !Array.isArray(publicEnvelope)
      ? {
          metadata: { ...metadata, public_envelope: publicEnvelope },
          encryption_algorithm: String(
            (publicEnvelope as Record<string, unknown>).encryption_algorithm
              || body.encryption_algorithm
              || "client-supplied-ciphertext",
          ),
        }
      : { metadata }),
  };

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
        "X-Admin-Api-Key": storeToken,
      },
      body: JSON.stringify(forwardedBody),
    });

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
