/**
 * GET /api/chains/[chainId]/health
 * Returns health status for a specific chain
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getChainRegistry } from "@/lib/chains/registry";
import type { ChainId } from "@/lib/chains/types";

interface HealthStatus {
  chainId: string;
  status: "healthy" | "warning" | "critical";
  blockHeight: number;
  latency: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { chainId } = req.query;
  if (!chainId || typeof chainId !== "string") {
    return res.status(400).json({ error: "chainId required" });
  }

  try {
    const registry = getChainRegistry();
    const chain = registry.getChain(chainId as ChainId);

    if (!chain) {
      return res.status(404).json({ error: "Chain not found" });
    }

    const rpcUrl = chain.rpcUrls?.[0];
    if (!rpcUrl) {
      return res.status(400).json({ error: "No RPC URL configured" });
    }

    const health = await checkHealth(chainId, rpcUrl);
    return res.status(200).json(health);
  } catch (err) {
    return res.status(500).json({
      error: "Health check failed",
      details: err instanceof Error ? err.message : "Unknown",
    });
  }
}

async function checkHealth(chainId: string, rpcUrl: string): Promise<HealthStatus> {
  const start = Date.now();

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getblockcount",
      params: [],
      id: 1,
    }),
  });

  const latency = Date.now() - start;
  const data = await response.json();

  const blockHeight = data.result || 0;

  return {
    chainId,
    status: latency < 1000 ? "healthy" : latency < 3000 ? "warning" : "critical",
    blockHeight,
    latency,
  };
}
