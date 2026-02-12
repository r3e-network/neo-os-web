import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";

const API_BASE = process.env.EDGE_API_BASE;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!API_BASE) {
    logger.warn("EDGE_API_BASE not configured, skipping twitter-feed");
    return res.status(200).json({ tweets: [] });
  }

  try {
    const response = await fetch(`${API_BASE}/twitter-feed`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    logger.error("Twitter feed fetch error", err);
    res.status(200).json({ tweets: [] });
  }
}
