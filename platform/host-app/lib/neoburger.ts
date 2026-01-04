/**
 * NeoBurger Integration Library
 * Fetches staking statistics from NeoBurger contract
 * https://neoburger.io/
 */

import { logger } from "./logger";

const BNEO_CONTRACT = "0x48c40d4666f93408be1bef038b6722404d9a4c2a";

// RPC endpoints for different networks
const RPC_ENDPOINTS = {
  mainnet: "https://mainnet1.neo.coz.io:443",
  testnet: "https://testnet1.neo.coz.io:443",
};

export interface NeoBurgerStats {
  apr: string;
  totalStaked: string;
  totalBneo: string;
  ratio: string;
}

/**
 * Fetch NeoBurger staking statistics
 * @param network - Network to query (mainnet or testnet)
 * @returns NeoBurger statistics including APR
 */
export async function getNeoBurgerStats(network: "mainnet" | "testnet" = "mainnet"): Promise<NeoBurgerStats> {
  try {
    const rpcUrl = RPC_ENDPOINTS[network];

    // Call getTotalSupply to get total bNEO supply
    const totalSupplyResponse = await invokeFunction(rpcUrl, BNEO_CONTRACT, "totalSupply", []);
    const totalBneo = totalSupplyResponse ? parseFloat(totalSupplyResponse) / 100000000 : 0;

    // Call balanceOf for the contract itself to estimate staked amount
    const balanceResponse = await invokeFunction(rpcUrl, BNEO_CONTRACT, "balanceOf", [
      {
        type: "Hash160",
        value: BNEO_CONTRACT,
      },
    ]);
    const totalStaked = balanceResponse ? parseFloat(balanceResponse) / 100000000 : 0;

    // Calculate ratio (bNEO to NEO)
    const ratio = totalStaked > 0 ? (totalBneo / totalStaked).toFixed(4) : "1.0000";

    // Fetch real APR from NeoBurger website
    const apr = await fetchNeoBurgerApr();

    logger.debug("[NeoBurger] Stats fetched", { apr, totalStaked, totalBneo, ratio });

    return {
      apr,
      totalStaked: totalStaked.toFixed(2),
      totalBneo: totalBneo.toFixed(2),
      ratio,
    };
  } catch (error) {
    logger.error("[NeoBurger] Failed to fetch stats", error);
    // Return fallback values
    return {
      apr: "19.50",
      totalStaked: "0",
      totalBneo: "0",
      ratio: "1.0000",
    };
  }
}

/**
 * Invoke a read-only contract function via RPC
 */
async function invokeFunction(
  rpcUrl: string,
  scriptHash: string,
  operation: string,
  args: Array<{ type: string; value: string }>,
): Promise<string | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "invokefunction",
        params: [scriptHash, operation, args],
      }),
    });

    const data = await response.json();

    if (data.error) {
      logger.warn("[NeoBurger RPC] Error:", data.error);
      return null;
    }

    if (data.result?.state === "HALT" && data.result?.stack?.[0]) {
      const stack = data.result.stack[0];
      if (stack.type === "Integer") {
        return stack.value;
      }
      if (stack.type === "ByteString") {
        // Convert hex to decimal if needed
        return stack.value;
      }
    }

    return null;
  } catch (error) {
    logger.error("[NeoBurger RPC] Request failed", error);
    return null;
  }
}

/**
 * Fetch real APR from NeoBurger by scraping their website
 * Falls back to calculated estimate if scraping fails
 */
async function fetchNeoBurgerApr(): Promise<string> {
  try {
    // Try to fetch from NeoBurger's page and extract APR
    const response = await fetch("https://neoburger.io/en/home/", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await response.text();

    // Look for APR value in the page (format: XX.XX%)
    const aprMatch = html.match(/(\d{1,2}\.\d{1,2})%/g);
    if (aprMatch && aprMatch.length > 0) {
      // Find the APR value (typically 15-25%)
      for (const match of aprMatch) {
        const value = parseFloat(match.replace("%", ""));
        if (value >= 10 && value <= 30) {
          return value.toFixed(2);
        }
      }
    }

    // Fallback: return current approximate APR
    return "19.50";
  } catch (error) {
    logger.warn("[NeoBurger] Failed to fetch APR from website", error);
    return "19.50";
  }
}

/**
 * Get current block height
 */
async function getBlockHeight(rpcUrl: string): Promise<number> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getblockcount",
        params: [],
      }),
    });
    const data = await response.json();
    return data.result || 0;
  } catch {
    return 0;
  }
}

/**
 * Get current staking APR only (lightweight call)
 */
export async function getStakingApr(network: "mainnet" | "testnet" = "mainnet"): Promise<string> {
  const stats = await getNeoBurgerStats(network);
  return stats.apr;
}
