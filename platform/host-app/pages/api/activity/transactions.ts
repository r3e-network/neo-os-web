import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "../../../lib/edge";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    return apiError.internal(res, "Edge functions not configured");
  }

  const params = new URLSearchParams();
  const { app_id, limit, after_id } = req.query;

  if (app_id) {
    const appIdStr = String(app_id);
    if (!/^[a-zA-Z0-9._-]+$/.test(appIdStr)) {
      return apiError.badRequest(res, "Invalid app_id");
    }
    params.set("app_id", appIdStr);
  }
  if (limit) {
    const parsed = parseInt(String(limit), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return apiError.badRequest(res, "limit must be a positive integer <= 100");
    }
    params.set("limit", String(parsed));
  }
  if (after_id) {
    const afterIdStr = String(after_id);
    if (!/^[a-zA-Z0-9]+$/.test(afterIdStr)) {
      return apiError.badRequest(res, "Invalid after_id");
    }
    params.set("after_id", afterIdStr);
  }

  try {
    const url = `${base}/transactions-list?${params}`;
    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return apiError.internal(res, "Upstream request failed");
    }
    const data = await upstream.json();
    res.setHeader("Cache-Control", "no-store, private");
    res.status(200).json(data);
  } catch (err) {
    logger.error("Failed to fetch transactions:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res, "Failed to fetch transactions");
  }
}
