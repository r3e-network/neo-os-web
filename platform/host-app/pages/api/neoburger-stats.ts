import type { NextApiRequest, NextApiResponse } from "next";
import { relaxedLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

const API_BASE = process.env.EDGE_API_BASE || "http://localhost:54321/functions/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return apiError.methodNotAllowed(res);
  if (relaxedLimit(req, res)) return;
  try {
    const response = await fetch(`${API_BASE}/neoburger-stats`, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    res.status(200).json(data);
  } catch {
    res.status(200).json({
      apy: "8.5",
      total_staked_formatted: "12.5M",
    });
  }
}
