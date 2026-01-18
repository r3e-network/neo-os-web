import type { NextApiRequest, NextApiResponse } from "next";
import { getBatchStats, getAggregatedBatchStats } from "../../../lib/miniapp-stats";
import { getChainRegistry } from "../../../lib/chains/registry";
import type { ChainId } from "../../../lib/chains/types";

/** Validate chain ID using registry */
function validateChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  return chain ? chain.id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get appIds from query or body
  let appIds: string[] = [];
  if (req.method === "GET" && req.query.appIds) {
    appIds = (req.query.appIds as string).split(",");
  } else if (req.method === "POST" && req.body?.appIds) {
    appIds = req.body.appIds;
  }

  if (!appIds.length) {
    return res.status(400).json({ error: "appIds required" });
  }

  const rawChainId = (req.query.chain_id as string) || (req.query.network as string);
  const aggregate = req.query.aggregate === "true" || rawChainId === "all";

  // If aggregate mode, return stats across all chains
  if (aggregate) {
    try {
      const stats = await getAggregatedBatchStats(appIds);
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      return res.status(200).json({ stats, chainId: "all", aggregated: true });
    } catch (error) {
      console.error("Aggregated batch stats error:", error);
      return res.status(500).json({ error: "Failed to fetch stats" });
    }
  }

  // Per-chain stats mode
  const chainId = validateChainId(rawChainId);

  if (!chainId) {
    const registry = getChainRegistry();
    const availableChains = registry.getActiveChains().map((c) => c.id);
    return res.status(400).json({
      error: "Invalid or missing chain_id. Use chain_id=all for aggregated stats.",
      availableChains,
    });
  }

  try {
    const stats = await getBatchStats(appIds, chainId);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.status(200).json({ stats, chainId });
  } catch (error) {
    console.error("Batch stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
