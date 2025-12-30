import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "../../../lib/edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    // Return empty data when Edge functions not configured (graceful degradation)
    return res.status(200).json({ events: [], has_more: false });
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
    });

    if (!upstream.ok) {
      // Return empty data on upstream error (graceful degradation)
      return res.status(200).json({ events: [], has_more: false });
    }

    const data = await upstream.json();
    res.status(200).json(data);
  } catch {
    // Return empty data on network error (graceful degradation)
    res.status(200).json({ events: [], has_more: false });
  }
}
