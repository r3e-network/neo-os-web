import type { NextApiRequest, NextApiResponse } from "next";
import { getLiveStatus } from "@/lib/miniapp-stats";
import { getContractAddress } from "@/lib/chains/contract-queries";
import { getChainRegistry } from "@/lib/chains/registry";
import type { ChainId } from "@/lib/chains/types";
import { logger } from "@/lib/logger";

// Map app IDs to contract names
const APP_CONTRACT_NAMES: Record<string, string> = {
  "miniapp-lottery": "lottery",
  "miniapp-coinflip": "coinFlip",
  "miniapp-dicegame": "diceGame",
  "miniapp-neo-crash": "neoCrash",
  "miniapp-secretvote": "secretVote",
  "miniapp-predictionmarket": "predictionMarket",
  "miniapp-flashloan": "flashLoan",
};

/** Validate chain ID using registry */
function validateChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  return chain ? chain.id : null;
}

/** Get contract address for an app on a specific chain */
function getAppContract(appId: string, chainId: ChainId): string | null {
  const contractName = APP_CONTRACT_NAMES[appId];
  if (!contractName) return null;
  return getContractAddress(contractName, chainId);
}

// Map app IDs to categories
const APP_CATEGORIES: Record<string, string> = {
  "miniapp-lottery": "gaming",
  "miniapp-coinflip": "gaming",
  "miniapp-dicegame": "gaming",
  "miniapp-neo-crash": "gaming",
  "miniapp-secretvote": "governance",
  "miniapp-predictionmarket": "defi",
  "miniapp-flashloan": "defi",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { appId } = req.query;
  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "appId required" });
  }

  const rawChainId = (req.query.chain_id as string) || (req.query.network as string);
  const chainId = validateChainId(rawChainId);

  if (!chainId) {
    const registry = getChainRegistry();
    const availableChains = registry.getActiveChains().map((c) => c.id);
    return res.status(400).json({
      error: "Invalid or missing chain_id",
      availableChains,
    });
  }

  const contractAddress = (req.query.contract as string) || getAppContract(appId, chainId);
  const category = (req.query.category as string) || APP_CATEGORIES[appId] || "gaming";

  if (!contractAddress) {
    return res.status(400).json({ error: "contract address required or unknown app" });
  }

  try {
    const status = await getLiveStatus(appId, contractAddress, category, chainId);
    res.status(200).json({ status, chainId });
  } catch (error) {
    logger.error("Live status error", error);
    res.status(500).json({ error: "Failed to fetch live status" });
  }
}
