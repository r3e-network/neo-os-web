import type { NextApiRequest, NextApiResponse } from "next";
import { getMiniAppStats } from "../../../../lib/miniapp-stats";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const { appId } = req.query;
  if (!appId || typeof appId !== "string") {
    return apiError.badRequest(res, "appId is required");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  const network = (req.query.network as "testnet" | "mainnet") || "testnet";

  try {
    const stats = await getMiniAppStats(appId, network);
    if (!stats) {
      return apiError.notFound(res, "App not found");
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ stats });
    return;
  } catch (error) {
    logger.error(
      "Stats fetch error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to fetch stats");
  }
}
