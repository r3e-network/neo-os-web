import type { NextApiRequest, NextApiResponse } from "next";
import { buildEdgeUrl, forwardAuthHeaders } from "../../lib/edge";
import { apiError } from "../../lib/api-response";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  const url = buildEdgeUrl("miniapp-notifications", req.query);
  if (!url) {
    // Return empty notifications for local development when Edge is not configured
    return res.status(200).json({ notifications: [] });
  }

  try {
    const upstream = await fetch(url.toString(), { method: "GET", headers: forwardAuthHeaders(req) });

    // Fallback for local dev when Edge function returns 404
    if (upstream.status === 404) {
      return res.status(200).json({ notifications: [] });
    }

    let payload: unknown = null;
    try {
      payload = await upstream.json();
    } catch {
      return apiError.gatewayError(res, "invalid upstream response");
    }
    res.status(upstream.status).json(payload);
  } catch {
    // Fallback for local development when Edge function is unavailable
    return res.status(200).json({ notifications: [] });
  }
}
