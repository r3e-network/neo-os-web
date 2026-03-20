import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";

function resolveMorpheusPublicApiUrl(networkInput?: string | null) {
  const network = String(networkInput || "").trim().toLowerCase() === "testnet" ? "testnet" : "mainnet";
  const explicit = String(process.env.MORPHEUS_PUBLIC_API_URL || process.env.NEXT_PUBLIC_MORPHEUS_PUBLIC_API_URL || "").trim();
  // Confidential store still lives behind the web gateway `/api/confidential/store`.
  // The new Phala runtime domains are used for direct runtime calls, not this web-only route.
  const fallback = "https://neo-morpheus-oracle-web.vercel.app";
  return (explicit || fallback || "").replace(/\/$/, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  if (String(req.method || "").toUpperCase() !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const network = String(req.body?.network || req.body?.morpheus_network || "").trim() || "testnet";
  const baseUrl = resolveMorpheusPublicApiUrl(network);
  if (!baseUrl) {
    return apiError.configError(res, "Morpheus public API URL is not configured");
  }

  const body = req.body || {};
  const ciphertext = String(body.ciphertext || "").trim();
  if (!ciphertext) {
    return apiError.badRequest(res, "ciphertext is required");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const upstream = await fetch(`${baseUrl}/api/confidential/store`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    if (controller.signal.aborted) {
      return apiError.gatewayTimeout(res, "Morpheus confidential store timed out");
    }
    return apiError.gatewayError(res, error instanceof Error ? error.message : "Morpheus confidential store failed");
  } finally {
    clearTimeout(timeoutId);
  }
}
