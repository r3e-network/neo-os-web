/**
 * GET /api/chains
 * Returns list of supported chains
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getChainRegistry } from "@/lib/chains/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const registry = getChainRegistry();
    const chains = registry.getChains();

    // Filter by type if specified
    const { type } = req.query;
    const filtered = type ? chains.filter((c) => c.type === type) : chains;

    return res.status(200).json({ chains: filtered });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to get chains",
      details: err instanceof Error ? err.message : "Unknown",
    });
  }
}
