import type { NextApiRequest, NextApiResponse } from "next";

const NEO_RPC_TESTNET = "https://testnet1.neo.coz.io:443";
const NEO_RPC_MAINNET = "https://mainnet1.neo.coz.io:443";

interface ChainHealth {
  network: "testnet" | "mainnet";
  lastBlockTime: number;
  blockHeight: number;
  pendingTxCount: number;
  status: "healthy" | "warning" | "critical";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const network = (req.query.network as string) || "testnet";
  const rpcUrl = network === "mainnet" ? NEO_RPC_MAINNET : NEO_RPC_TESTNET;

  try {
    const health = await checkChainHealth(rpcUrl, network as "testnet" | "mainnet");
    return res.status(200).json(health);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to check chain health",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

async function checkChainHealth(rpcUrl: string, network: "testnet" | "mainnet"): Promise<ChainHealth> {
  // Get block count
  const blockRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getblockcount",
      params: [],
      id: 1,
    }),
  });
  const blockData = await blockRes.json();
  const blockHeight = blockData.result || 0;

  // Get latest block header for timestamp
  const headerRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getblockheader",
      params: [blockHeight - 1, true],
      id: 2,
    }),
  });
  const headerData = await headerRes.json();
  const lastBlockTime = headerData.result?.time || 0;

  // Calculate status
  const now = Math.floor(Date.now() / 1000);
  const timeSinceBlock = now - lastBlockTime;

  let status: "healthy" | "warning" | "critical" = "healthy";
  if (timeSinceBlock > 120) status = "critical";
  else if (timeSinceBlock > 60) status = "warning";

  return {
    network,
    lastBlockTime,
    blockHeight,
    pendingTxCount: 0,
    status,
  };
}
