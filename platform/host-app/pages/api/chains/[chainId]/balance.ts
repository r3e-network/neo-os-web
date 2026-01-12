/**
 * GET /api/chains/[chainId]/balance
 * Returns balance for an address on a specific chain
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getChainRegistry } from "@/lib/chains/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { chainId, address } = req.query;
  if (!chainId || !address) {
    return res.status(400).json({ error: "chainId and address required" });
  }

  try {
    const registry = getChainRegistry();
    const chain = registry.getChain(chainId as string);

    if (!chain) {
      return res.status(404).json({ error: "Chain not found" });
    }

    const balance = await fetchBalance(chain, address as string);
    return res.status(200).json({ chainId, address, balance });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to get balance",
      details: err instanceof Error ? err.message : "Unknown",
    });
  }
}

async function fetchBalance(
  chain: ReturnType<ReturnType<typeof getChainRegistry>["getChain"]>,
  address: string,
): Promise<string> {
  if (!chain) return "0";
  const rpcUrl = chain.rpcUrls?.[0];
  if (!rpcUrl) return "0";

  if (chain.type === "evm") {
    // EVM JSON-RPC eth_getBalance
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    });
    const data = await response.json();
    return data.result || "0x0";
  }

  // Neo N3 RPC
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getnep17balances",
      params: [address],
      id: 1,
    }),
  });
  const data = await response.json();
  return JSON.stringify(data.result?.balance || []);
}
