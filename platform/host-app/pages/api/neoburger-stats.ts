import type { NextApiRequest, NextApiResponse } from "next";
import { getNeoBurgerStats } from "../../lib/neoburger";
import type { ChainId } from "../../lib/chains/types";
import { getChainRegistry } from "../../lib/chains/registry";

/** Validate and resolve Neo N3 chain ID */
function resolveNeoN3ChainId(rawChainId: string | undefined): ChainId {
  const registry = getChainRegistry();

  // If chain_id provided, validate it's a Neo N3 chain
  if (rawChainId) {
    const chain = registry.getChain(rawChainId as ChainId);
    if (chain && chain.type === "neo-n3") {
      return chain.id;
    }
  }

  // Default to neo-n3-mainnet for NeoBurger stats
  return "neo-n3-mainnet" as ChainId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawChainId = req.query.chain_id as string | undefined;
  const chainId = resolveNeoN3ChainId(rawChainId);

  try {
    const stats = await getNeoBurgerStats(chainId);
    res.status(200).json({
      apy: stats.apr,
      total_staked_formatted: stats.totalStakedFormatted,
      chainId,
      dataSource: "chain",
    });
  } catch (error) {
    console.error("NeoBurger stats error:", error);
    // Return error instead of fake data - no mock fallback
    res.status(503).json({
      error: "Failed to fetch NeoBurger stats",
      message: error instanceof Error ? error.message : "Unknown error",
      chainId,
    });
  }
}
