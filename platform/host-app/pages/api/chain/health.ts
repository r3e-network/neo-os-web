import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

const NEO_RPC_TESTNET = process.env.NEO_RPC_TESTNET || "https://testnet1.neo.coz.io:443";
const NEO_RPC_MAINNET = process.env.NEO_RPC_MAINNET || "https://mainnet1.neo.coz.io:443";

interface ChainHealth {
  network: "testnet" | "mainnet";
  lastBlockTime: number;
  blockHeight: number;
  pendingTxCount: number;
  status: "healthy" | "warning" | "critical";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  if (standardLimit(req, res)) return;

  const network = (req.query.network as string) || "testnet";
  const rpcUrl = network === "mainnet" ? NEO_RPC_MAINNET : NEO_RPC_TESTNET;

  try {
    const health = await checkChainHealth(rpcUrl, network as "testnet" | "mainnet");
    return res.status(200).json(health);
  } catch (err) {
    logger.error("Chain health check failed:", err);
    return apiError.internal(res, "Failed to check chain health");
  }
}

async function checkChainHealth(rpcUrl: string, network: "testnet" | "mainnet"): Promise<ChainHealth> {
  const rpcTimeout = 10000;

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
    signal: AbortSignal.timeout(rpcTimeout),
  });
  if (!blockRes.ok) {
    throw new Error(`RPC error: ${blockRes.status}`);
  }
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
    signal: AbortSignal.timeout(rpcTimeout),
  });
  if (!headerRes.ok) {
    throw new Error(`RPC error: ${headerRes.status}`);
  }
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
