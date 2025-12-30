import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "../../../lib/edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    // Return empty data when Edge functions not configured (graceful degradation)
    return res.status(200).json({ transactions: [], has_more: false });
  }

  const params = new URLSearchParams();
  const { app_id, limit, after_id } = req.query;

  if (app_id) params.set("app_id", String(app_id));
  if (limit) params.set("limit", String(limit));
  if (after_id) params.set("after_id", String(after_id));

  try {
    const url = `${base}/transactions-list?${params}`;
    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
      },
    });

    if (!upstream.ok) {
      // Return empty data on upstream error (graceful degradation)
      return res.status(200).json({ transactions: [], has_more: false });
    }

    const data = await upstream.json();
    res.status(200).json(data);
  } catch {
    // Return empty data on network error (graceful degradation)
    res.status(200).json({ transactions: [], has_more: false });
  }
}
