import type { NextApiRequest, NextApiResponse } from "next";
import { createHandler } from "@/lib/api/create-handler";
import { getBatchStats, getAggregatedBatchStats } from "@/lib/miniapp-stats";
import { getChainRegistry } from "@/lib/chains/registry";
import type { ChainId } from "@/lib/chains/types";

/** Validate chain ID using registry */
function validateChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  return chain ? chain.id : null;
}

/** Shared stats logic for both GET and POST. */
async function handleBatchStats(req: NextApiRequest, res: NextApiResponse) {
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

  if (aggregate) {
    const stats = await getAggregatedBatchStats(appIds);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ stats, chainId: "all", aggregated: true });
  }

  const chainId = validateChainId(rawChainId);
  if (!chainId) {
    const registry = getChainRegistry();
    const availableChains = registry.getActiveChains().map((c) => c.id);
    return res.status(400).json({
      error: "Invalid or missing chain_id. Use chain_id=all for aggregated stats.",
      availableChains,
    });
  }

  const stats = await getBatchStats(appIds, chainId);
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  return res.status(200).json({ stats, chainId });
}

export default createHandler({
  auth: "none",
  rateLimit: "api",
  methods: {
    GET: async (req, res) => handleBatchStats(req, res),
    POST: async (req, res) => handleBatchStats(req, res),
  },
});
