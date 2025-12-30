import type { NextApiRequest, NextApiResponse } from "next";

const API_BASE = process.env.EDGE_API_BASE || "http://localhost:54321/functions/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch(`${API_BASE}/twitter-feed`);
    const data = await response.json();
    res.status(200).json(data);
  } catch {
    res.status(200).json({ tweets: [] });
  }
}
