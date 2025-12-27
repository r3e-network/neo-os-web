import type { NextApiRequest, NextApiResponse } from "next";

const EDGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { app_id, limit = "30" } = req.query;
    const params = new URLSearchParams();
    if (app_id) params.set("app_id", String(app_id));
    params.set("limit", String(limit));

    const url = `${EDGE_URL}/functions/v1/transactions-list?${params}`;
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return res.status(response.status).json({ transactions: [] });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Transactions API error:", error);
    return res.status(200).json({ transactions: [] });
  }
}
