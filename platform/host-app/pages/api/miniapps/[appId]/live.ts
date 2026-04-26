import type { NextApiRequest, NextApiResponse } from "next";
import { getLiveStatus } from "../../../../lib/miniapp-stats";
import { getFlagshipApps } from "../../../../lib/chain";
import { loadBundledMiniAppById } from "../../../../lib/miniapp-definitions";
import { isSharedModeApp } from "../../../../lib/chain/shared-mode";
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
    return apiError.badRequest(res, "appId required");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  // Auto-resolve contract hash from app ID (whitelist only)
  const bundledApp = await loadBundledMiniAppById(appId).catch(() => null);
  const sharedMode = bundledApp ? isSharedModeApp(bundledApp) : false;
  const network = (req.query.network as "testnet" | "mainnet") || "testnet";
  const flagshipApps = getFlagshipApps(network);
  const contractHash =
    flagshipApps[appId]?.contract || bundledApp?.contract_hash || "";
  const category =
    (req.query.category as string) ||
    flagshipApps[appId]?.category ||
    bundledApp?.category ||
    "gaming";

  if (!contractHash && !sharedMode) {
    return apiError.badRequest(res, "contract hash required or unknown app");
  }

  try {
    const status = await getLiveStatus(appId, contractHash, category, network);
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    res.status(200).json({ status });
    return;
  } catch (error) {
    logger.error(
      "Live status error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to fetch live status");
  }
}
