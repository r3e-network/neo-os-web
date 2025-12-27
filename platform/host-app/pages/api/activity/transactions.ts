import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "../../../lib/edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    return res.status(500).json({ error: "Edge functions not configured" });
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

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transactions";
    res.status(500).json({ error: msg });
  }
}
