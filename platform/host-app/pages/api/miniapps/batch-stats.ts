import type { NextApiRequest, NextApiResponse } from "next";
import { getBatchStats } from "../../../lib/miniapp-stats";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const network = (req.query.network as string) === "mainnet" ? "mainnet" as const : "testnet" as const;

  // Get appIds from query or body
  let appIds: string[] = [];
  if (req.method === "GET" && req.query.appIds) {
    appIds = (req.query.appIds as string).slice(0, 4096).split(",").map((id) => id.trim().slice(0, 128)).filter(Boolean);
  } else if (req.method === "POST" && req.body?.appIds) {
    appIds = Array.isArray(req.body.appIds)
      ? req.body.appIds.slice(0, 50).map((id: unknown) => String(id ?? "").trim().slice(0, 128)).filter(Boolean)
      : [];
  }

  // Limit to prevent DoS
  if (!appIds.length) {
    return apiError.badRequest(res, "appIds required");
  }
  if (appIds.length > 50) {
    return apiError.badRequest(res, "Maximum 50 appIds per request");
  }

  try {
    const stats = await getBatchStats(appIds, network);
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ stats });
  } catch (error) {
    logger.error("Batch stats error:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Failed to fetch stats");
  }
}
