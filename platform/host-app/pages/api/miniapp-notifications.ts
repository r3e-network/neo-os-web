import type { NextApiRequest, NextApiResponse } from "next";
import { buildEdgeUrl, forwardAuthHeaders } from "../../lib/edge";
import { apiError } from "../../lib/api-response";
import { standardLimit } from "../../lib/rate-limit";
import { logger } from "../../lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const url = buildEdgeUrl("miniapp-notifications", req.query);
  if (!url) {
    return apiError.configError(res, "EDGE_BASE_URL not configured");
  }

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      method: "GET",
      headers: forwardAuthHeaders(req),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    logger.warn(
      "miniapp-notifications upstream request failed:",
      err instanceof Error ? err.message : "unknown error",
    );
    return apiError.gatewayError(res, "upstream request failed");
  }
  let payload: unknown = null;
  try {
    payload = await upstream.json();
  } catch (err) {
    logger.warn(
      "miniapp-notifications invalid upstream response:",
      err instanceof Error ? err.message : "unknown error",
    );
    return apiError.gatewayError(res, "invalid upstream response");
  }

  if (!upstream.ok) {
    return apiError.gatewayError(res, "upstream request failed");
  }
  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json(payload);
  return;
}
