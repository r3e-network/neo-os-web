import type { NextApiRequest, NextApiResponse } from "next";
import { getChainRpcUrl } from "../../../lib/chain/rpc-client";
import { getChainRegistry } from "../../../lib/chains/registry";
import type { ChainId } from "../../../lib/chains/types";
import { isNeoN3Chain } from "../../../lib/chains/types";

interface ChainHealth {
  chainId: ChainId;
  chainType: "neo-n3" | "evm";
  lastBlockTime: number;
  blockHeight: number;
  pendingTxCount: number;
  status: "healthy" | "warning" | "critical";
}

/** Validate and normalize chain ID using registry */
function validateChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  return chain ? chain.id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
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

  try {
    const health = await checkChainHealth(chainId);
    return res.status(200).json(health);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to check chain health",
      chainId,
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

async function checkChainHealth(chainId: ChainId): Promise<ChainHealth> {
  const registry = getChainRegistry();
  const chainConfig = registry.getChain(chainId);

  if (!chainConfig) {
    throw new Error(`Chain ${chainId} not found in registry`);
  }

  const rpcUrl = getChainRpcUrl(chainId);
  const isNeo = isNeoN3Chain(chainConfig);

  if (isNeo) {
    return checkNeoN3Health(chainId, rpcUrl);
  } else {
    return checkEVMHealth(chainId, rpcUrl);
  }
}

/** Check Neo N3 chain health */
async function checkNeoN3Health(chainId: ChainId, rpcUrl: string): Promise<ChainHealth> {
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

  // Calculate status based on time since last block
  const now = Math.floor(Date.now() / 1000);
  const timeSinceBlock = now - lastBlockTime;

  let status: "healthy" | "warning" | "critical" = "healthy";
  if (timeSinceBlock > 120) status = "critical";
  else if (timeSinceBlock > 60) status = "warning";

  return {
    chainId,
    chainType: "neo-n3",
    lastBlockTime,
    blockHeight,
    pendingTxCount: 0,
    status,
  };
}

/** Check EVM chain health */
async function checkEVMHealth(chainId: ChainId, rpcUrl: string): Promise<ChainHealth> {
  // Get latest block number
  const blockNumRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    }),
  });
  const blockNumData = await blockNumRes.json();
  const blockHeight = parseInt(blockNumData.result || "0x0", 16);

  // Get latest block for timestamp
  const blockRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: ["latest", false],
      id: 2,
    }),
  });
  const blockData = await blockRes.json();
  const lastBlockTime = parseInt(blockData.result?.timestamp || "0x0", 16);

  // Get pending transaction count
  const pendingRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBlockTransactionCountByNumber",
      params: ["pending"],
      id: 3,
    }),
  });
  const pendingData = await pendingRes.json();
  const pendingTxCount = parseInt(pendingData.result || "0x0", 16);

  // Calculate status - EVM chains typically have faster block times
  const now = Math.floor(Date.now() / 1000);
  const timeSinceBlock = now - lastBlockTime;

  let status: "healthy" | "warning" | "critical" = "healthy";
  if (timeSinceBlock > 60) status = "critical";
  else if (timeSinceBlock > 30) status = "warning";

  return {
    chainId,
    chainType: "evm",
    lastBlockTime,
    blockHeight,
    pendingTxCount,
    status,
  };
}
