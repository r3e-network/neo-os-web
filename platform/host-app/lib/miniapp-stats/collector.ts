/**
 * MiniApp Stats Collector
 * Collects transaction and user data from blockchain with multi-chain support
 * Supports Neo N3 and EVM chains
 */

import type { MiniAppStats, MiniAppLiveStatus, ContractEvent } from "./types";
import type { ChainId } from "../chains/types";
import { getChainRpcUrl, isNeoN3ChainId, isEVMChainId } from "../chain/rpc-client";

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
  fromBlock: number,
  toBlock: number,
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
  } catch {
    // Silently handle - indexer would be more reliable
  }

  return events;
}

/**
 * Get contract events for EVM chains (using eth_getLogs)
 */
async function getEVMContractEvents(
  chainId: ChainId,
  contractAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<ContractEvent[]> {
  const events: ContractEvent[] = [];

  try {
    const logs = await rpcCall(chainId, "eth_getLogs", [
      {
        address: contractAddress,
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: `0x${toBlock.toString(16)}`,
      },
    ]);

    if (Array.isArray(logs)) {
      for (const log of logs) {
        events.push({
          txHash: log.transactionHash,
          blockIndex: parseInt(log.blockNumber, 16),
          timestamp: Date.now(),
          eventName: log.topics?.[0]?.slice(0, 10) || "unknown",
          appId: contractAddress,
          sender: log.topics?.[1] ? `0x${log.topics[1].slice(26)}` : "",
          amount: log.data || "0x0",
        });
      }
    }
  } catch {
    // Silently handle - indexer would be more reliable
  }

  return events;
}

/**
 * Get contract events with multi-chain support
 * Automatically detects chain type and uses appropriate RPC method
 */
async function getContractEvents(
  chainId: ChainId,
  contractAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<ContractEvent[]> {
  if (isEVMChainId(chainId)) {
    return getEVMContractEvents(chainId, contractAddress, fromBlock, toBlock);
  }
  return getNeoContractEvents(chainId, contractAddress, fromBlock, toBlock);
}

export { getContractEvents, rpcCall, statsCache, CACHE_TTL };
