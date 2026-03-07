import type { NextApiRequest, NextApiResponse } from "next";
import { relaxedLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getEdgeFunctionsBaseUrl } from "@/lib/edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return apiError.methodNotAllowed(res);
  if (relaxedLimit(req, res)) return;

  const apiBase = getEdgeFunctionsBaseUrl();
  if (!apiBase) return res.status(200).json({ apy: "0", total_staked_formatted: "0" });

  try {
    const response = await fetch(`${apiBase}/neoburger-stats`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch (err) {
    logger.warn("Failed to fetch neoburger stats:", err instanceof Error ? err.message : "unknown error");
    res.status(200).json({
      apy: "8.5",
      total_staked_formatted: "12.5M",
    });
  }
}
