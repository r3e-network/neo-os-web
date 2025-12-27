import type { NextApiRequest, NextApiResponse } from "next";
import { buildEdgeUrl, forwardAuthHeaders } from "../../../lib/edge";
import { apiError } from "../../../lib/api-response";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  const url = buildEdgeUrl("market-trending", req.query);
  if (!url) {
    return apiError.configError(res, "EDGE_BASE_URL not configured");
  }

  const upstream = await fetch(url.toString(), { method: "GET", headers: forwardAuthHeaders(req) });
  let payload: unknown = null;
  try {
    payload = await upstream.json();
  } catch {
    return apiError.gatewayError(res, "invalid upstream response");
  }

  res.status(upstream.status).json(payload);
}
