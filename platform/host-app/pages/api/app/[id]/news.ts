import type { NextApiRequest, NextApiResponse } from "next";
import { buildEdgeUrl, forwardAuthHeaders } from "../../../../lib/edge";
import { apiError } from "../../../../lib/api-response";
import { relaxedLimit } from "../../../../lib/rate-limit";
import { logger } from "../../../../lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  const appId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const normalizedAppId = String(appId ?? "").trim();
  if (!normalizedAppId) {
    return apiError.badRequest(res, "app id required");
  }

  const query: Record<string, string> = { app_id: normalizedAppId };
  const limitRaw = Array.isArray(req.query.limit)
    ? req.query.limit[0]
    : req.query.limit;
  if (limitRaw) query.limit = String(limitRaw);

  const url = buildEdgeUrl("miniapp-notifications", query);
  if (!url) {
    return apiError.configError(res, "EDGE_BASE_URL not configured");
  }

  const emptyFeed = () => {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ items: [], total: 0 });
    return;
  };

  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: forwardAuthHeaders(req),
      signal: AbortSignal.timeout(15000),
    });
    if (upstream.status === 404) {
      // Edge route not deployed in this environment — degrade gracefully.
      return emptyFeed();
    }
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      logger.warn("Failed to parse news upstream response");
      return emptyFeed();
    }
    if (upstream.ok) {
      res.setHeader(
        "Cache-Control",
        "s-maxage=300, stale-while-revalidate=600",
      );
    }
    if (!upstream.ok) {
      logger.warn("News upstream request failed:", upstream.status);
      return emptyFeed();
    }
    res.status(upstream.status).json(payload);
    return;
  } catch (err) {
    logger.warn(
      "Failed to fetch news:",
      err instanceof Error ? err.message : "unknown error",
    );
    return emptyFeed();
  }
}
