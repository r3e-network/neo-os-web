/**
 * MiniApp Stats Collector
 * Collects transaction and user data from blockchain (Neo N3 only)
 */

import type { MiniAppStats, ContractEvent } from "./types";
import type { ChainId } from "../chains/types";
import { getChainRpcUrl } from "../chains/rpc-functions";
import { logger } from "@/lib/logger";

// Cache for stats (refreshed periodically)
const statsCache = new Map<string, { stats: MiniAppStats; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * RPC call helper with multi-chain support
 */
async function rpcCall(chainId: ChainId, method: string, params: unknown[]) {
  const endpoint = getChainRpcUrl(chainId);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const data = await res.json();
  return data.result;
}

/**
 * Get application log for a contract (Neo N3)
 */
async function getNeoContractEvents(
  chainId: ChainId,
  contractAddress: string,
  _fromBlock: number,
  _toBlock: number,
): Promise<ContractEvent[]> {
  const events: ContractEvent[] = [];

  try {
    const logs = await rpcCall(chainId, "getapplicationlog", [contractAddress]);
    if (logs?.executions) {
      for (const exec of logs.executions) {
        for (const notif of exec.notifications || []) {
          events.push({
            txHash: logs.txid,
            blockIndex: logs.blockindex || 0,
            timestamp: Date.now(),
            eventName: notif.eventname,
            appId: contractAddress,
            sender: notif.state?.value?.[0]?.value || "",
            amount: notif.state?.value?.[1]?.value || "0",
          });
        }
      }
    }
  } catch (err) {
    logger.warn("collectRecentEvents RPC fallback failed:", err);
  }

  return events;
}

/**
 * Get contract events (Neo N3)
 */
async function getContractEvents(
  chainId: ChainId,
  contractAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<ContractEvent[]> {
  return getNeoContractEvents(chainId, contractAddress, fromBlock, toBlock);
}

export { getContractEvents, rpcCall, statsCache, CACHE_TTL };
