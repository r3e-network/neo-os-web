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

  if (app_id) {
    const v = String(app_id);
    if (!/^[a-zA-Z0-9._-]+$/.test(v)) return apiError.badRequest(res, "Invalid app_id");
    params.set("app_id", v);
  }
  if (event_name) {
    const v = String(event_name);
    if (!/^[a-zA-Z0-9._-]+$/.test(v)) return apiError.badRequest(res, "Invalid event_name");
    params.set("event_name", v);
  }
  if (contract_hash) {
    const v = String(contract_hash);
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return apiError.badRequest(res, "Invalid contract_hash");
    params.set("contract_hash", v);
  }
  if (limit) {
    const parsed = parseInt(String(limit), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) return apiError.badRequest(res, "Invalid limit");
    params.set("limit", String(parsed));
  }
  if (after_id) {
    const v = String(after_id);
    if (!/^[a-zA-Z0-9_-]+$/.test(v)) return apiError.badRequest(res, "Invalid after_id");
    params.set("after_id", v);
  }

  try {
    const url = `${base}/events-list?${params}`;
    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    let data: unknown;
    try {
      data = await upstream.json();
    } catch {
      return apiError.internal(res, "Failed to parse upstream response");
    }
    res.status(upstream.status).json(data);
  } catch (err) {
    apiError.internal(res, "Failed to fetch events");
  }
}
