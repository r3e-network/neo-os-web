import type { NextApiRequest, NextApiResponse } from "next";
import { buildEdgeUrl, forwardAuthHeaders } from "../../../../lib/edge";
import { apiError } from "../../../../lib/api-response";
import { relaxedLimit } from "../../../../lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  if (limitRaw) query.limit = String(limitRaw);

  const url = buildEdgeUrl("miniapp-notifications", query);
  if (!url) {
    return apiError.configError(res, "EDGE_BASE_URL not configured");
  }

  try {
    const upstream = await fetch(url.toString(), { method: "GET", headers: forwardAuthHeaders(req), signal: AbortSignal.timeout(15000) });
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      return apiError.internal(res, "Failed to parse upstream response");
    }
    if (upstream.ok) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    }
    const status = upstream.ok ? upstream.status : 502;
    res.status(status).json(payload);
  } catch {
    return apiError.internal(res, "Failed to fetch news");
  }
}
