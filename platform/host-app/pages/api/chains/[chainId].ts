/**
 * GET /api/chains/[chainId]
 * Returns chain details and health status
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getChainRegistry } from "@/lib/chains/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { chainId } = req.query;
  if (!chainId || typeof chainId !== "string") {
    return res.status(400).json({ error: "Chain ID required" });
  }

  try {
    const registry = getChainRegistry();
    const chain = registry.getChain(chainId);

    if (!chain) {
      return res.status(404).json({ error: "Chain not found" });
    }

    return res.status(200).json({ chain });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to get chain",
      details: err instanceof Error ? err.message : "Unknown",
    });
  }
}
