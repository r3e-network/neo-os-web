import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "../../../lib/edge";
import { apiError } from "@/lib/api-response";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    return apiError.internal(res, "Edge functions not configured");
  }

  const params = new URLSearchParams();
  const { app_id, event_name, contract_hash, limit, after_id } = req.query;

  if (app_id) params.set("app_id", String(app_id));
  if (event_name) params.set("event_name", String(event_name));
  if (contract_hash) params.set("contract_hash", String(contract_hash));
  if (limit) params.set("limit", String(limit));
  if (after_id) params.set("after_id", String(after_id));

  try {
    const url = `${base}/events-list?${params}`;
    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch events";
    apiError.internal(res, msg);
  }
}
