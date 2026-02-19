import type { NextApiRequest, NextApiResponse } from "next";
import { relaxedLimit } from "@/lib/rate-limit";

const API_BASE = process.env.EDGE_API_BASE;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (relaxedLimit(req, res)) return;
  if (!API_BASE) return res.status(200).json({ tweets: [] });
  try {
    const response = await fetch(`${API_BASE}/twitter-feed`, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch {
    res.status(200).json({ tweets: [] });
  }
}
