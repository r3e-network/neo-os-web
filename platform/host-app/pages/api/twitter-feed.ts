import type { NextApiRequest, NextApiResponse } from "next";
import { relaxedLimit } from "@/lib/rate-limit";
import { getEdgeFunctionsBaseUrl } from "@/lib/edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (relaxedLimit(req, res)) return;
  if (req.method !== "GET") return res.status(405).end();

  const apiBase = getEdgeFunctionsBaseUrl();
  if (!apiBase) return res.status(200).json({ tweets: [] });

  try {
    const response = await fetch(`${apiBase}/twitter-feed`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch {
    res.status(200).json({ tweets: [] });
  }
}
