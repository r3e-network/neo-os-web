/**
 * MiniApp Stats Collector
 * Collects transaction and user data from Neo blockchain
 */

import type { MiniAppStats, MiniAppLiveStatus, ContractEvent } from "./types";

const NEO_RPC = {
  testnet: "https://testnet1.neo.coz.io:443",
  mainnet: "https://mainnet1.neo.coz.io:443",
};

// Cache for stats (refreshed periodically)
const statsCache = new Map<string, { stats: MiniAppStats; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * RPC call helper
 */
async function rpcCall(network: "testnet" | "mainnet", method: string, params: unknown[]) {
  const res = await fetch(NEO_RPC[network], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const data = await res.json();
  return data.result;
}

/**
 * Get application log for a contract
 */
async function getContractEvents(
  network: "testnet" | "mainnet",
  contractHash: string,
  fromBlock: number,
  toBlock: number,
): Promise<ContractEvent[]> {
  const events: ContractEvent[] = [];

  // Query contract events via Neo RPC getapplicationlog
  // Architecture: Direct RPC for real-time queries; historical data via NeoFS indexer
  try {
    const logs = await rpcCall(network, "getapplicationlog", [contractHash]);
    if (logs?.executions) {
      for (const exec of logs.executions) {
        for (const notif of exec.notifications || []) {
          events.push({
            txHash: logs.txid,
            blockIndex: logs.blockindex || 0,
            timestamp: Date.now(),
            eventName: notif.eventname,
            appId: contractHash,
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

export { getContractEvents, rpcCall, statsCache, CACHE_TTL };
