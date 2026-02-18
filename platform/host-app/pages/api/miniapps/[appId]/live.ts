import type { NextApiRequest, NextApiResponse } from "next";
import { getLiveStatus } from "../../../../lib/miniapp-stats";
import { CONTRACTS } from "../../../../lib/chain";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

// Map app IDs to contract hashes
const APP_CONTRACTS: Record<string, string> = {
  "miniapp-lottery": CONTRACTS.lottery,
  "miniapp-coinflip": CONTRACTS.coinFlip,
  "miniapp-dicegame": CONTRACTS.diceGame,
  "miniapp-neocrash": CONTRACTS.neoCrash,
  "miniapp-secretvote": CONTRACTS.secretVote,
  "miniapp-predictionmarket": CONTRACTS.predictionMarket,
  "miniapp-flashloan": CONTRACTS.flashLoan,
};

// Map app IDs to categories
const APP_CATEGORIES: Record<string, string> = {
  "miniapp-lottery": "gaming",
  "miniapp-coinflip": "gaming",
  "miniapp-dicegame": "gaming",
  "miniapp-neocrash": "gaming",
  "miniapp-secretvote": "governance",
  "miniapp-predictionmarket": "defi",
  "miniapp-flashloan": "defi",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  // Auto-resolve contract hash from app ID
  const contractHash = (req.query.contract as string) || APP_CONTRACTS[appId];
  const category = (req.query.category as string) || APP_CATEGORIES[appId] || "gaming";
  const network = (req.query.network as "testnet" | "mainnet") || "testnet";

  if (!contractHash) {
    return apiError.badRequest(res, "contract hash required or unknown app");
  }

  try {
    const status = await getLiveStatus(appId, contractHash, category, network);
    res.status(200).json({ status });
  } catch (error) {
    logger.error("Live status error:", error);
    apiError.internal(res, "Failed to fetch live status");
  }
}
