import type { NextApiRequest, NextApiResponse } from "next";
import { buildEdgeUrl, forwardAuthHeaders } from "../../lib/edge";
import { apiError } from "../../lib/api-response";
import { standardLimit } from "../../lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const url = buildEdgeUrl("miniapp-usage", req.query);
  if (!url) {
    return apiError.configError(res, "EDGE_BASE_URL not configured");
  }

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), { method: "GET", headers: forwardAuthHeaders(req), signal: AbortSignal.timeout(15000) });
  } catch {
    return apiError.gatewayError(res, "upstream request failed");
  }
  let payload: unknown = null;
  try {
    payload = await upstream.json();
  } catch {
    return apiError.gatewayError(res, "invalid upstream response");
  }

  res.setHeader("Cache-Control", "no-store, private");
  const status = upstream.ok ? upstream.status : 502;
  res.status(status).json(payload);
}
