/**
 * Real Card Data Service
 * Fetches live data from contracts for card displays
 * Supports multi-chain contract queries
 */

import { getLotteryState, getGameState, getVotingState, getContractStats, getContractAddress } from "@/lib/chain";
import type { ChainId } from "@/lib/chains/types";
import { getChainRegistry } from "@/lib/chains/registry";

/** Get native currency symbol for a chain */
function getNativeCurrency(chainId: ChainId): string {
  const registry = getChainRegistry();
  const chain = registry.getChain(chainId);
  if (chain) {
    return chain.nativeCurrency.symbol;
  }
  // Fallback based on chain ID prefix
  if (chainId.startsWith("neo-n3")) return "GAS";
  if (chainId.startsWith("neox")) return "GAS";
  if (chainId.startsWith("ethereum")) return "ETH";
  return "GAS";
}

export type CardType =
  | "live_countdown"
  | "live_multiplier"
  | "live_canvas"
  | "live_stats"
  | "live_voting"
  | "live_price";

// App ID to contract name mapping
const APP_CONTRACT_NAMES: Record<string, string> = {
  "miniapp-lottery": "lottery",
  "miniapp-coinflip": "coinFlip",
  "miniapp-dicegame": "diceGame",
  "miniapp-neo-crash": "neoCrash",
  "miniapp-canvas": "canvas",
};

/** Get contract address for an app on a specific chain */
function getAppContract(appId: string, chainId: ChainId): string | null {
  const contractName = APP_CONTRACT_NAMES[appId];
  if (!contractName) return null;
  return getContractAddress(contractName, chainId);
}

// Countdown data (Lottery, Auctions)
export interface CountdownData {
  jackpot: string;
  currency: string;
  endTime: number;
  participants: number;
}

export async function getCountdownData(appId: string, chainId: ChainId): Promise<CountdownData> {
  const contract = getAppContract(appId, chainId);
  const currency = getNativeCurrency(chainId);

  if (!contract) {
    return { jackpot: "0", currency, endTime: 0, participants: 0 };
  }

  const state = await getLotteryState(contract, chainId);
  return {
    jackpot: state.prizePool,
    currency,
    endTime: state.endTime,
    participants: state.ticketsSold,
  };
}

// Multiplier data (Crash games)
export interface MultiplierData {
  multiplier: number;
  trend: "up" | "down" | "stable";
  players: number;
}

export async function getMultiplierData(appId: string, chainId: ChainId): Promise<MultiplierData> {
  const contract = getAppContract(appId, chainId);
  if (!contract) {
    return { multiplier: 1.0, trend: "stable", players: 0 };
  }

  const state = await getGameState(contract, chainId);
  return {
    multiplier: state.currentMultiplier,
    trend: state.currentMultiplier > 1.5 ? "up" : "stable",
    players: state.playerCount,
  };
}

// Stats data (DeFi apps)
export interface StatsData {
  tvl: string;
  volume24h: string;
  users: number;
}

export async function getStatsData(appId: string, chainId: ChainId): Promise<StatsData> {
  const contract = getAppContract(appId, chainId);
  if (!contract) {
    return { tvl: "0", volume24h: "0", users: 0 };
  }

  const stats = await getContractStats(contract, chainId);
  return {
    tvl: stats.totalValueLocked,
    volume24h: stats.totalValueLocked,
    users: stats.uniqueUsers,
  };
}

// Voting data (Governance apps)
export interface VotingData {
  title: string;
  options: { label: string; percentage: number }[];
  totalVotes: number;
}

export async function getVotingData(appId: string, chainId: ChainId): Promise<VotingData> {
  const contract = getAppContract(appId, chainId);
  if (!contract) {
    return { title: "No Proposal", options: [], totalVotes: 0 };
  }

  const state = await getVotingState(contract, chainId);
  const total = state.totalVotes || 1;
  return {
    title: state.title,
    options: state.options.map((o) => ({
      label: o.label,
      percentage: Math.round((o.votes / total) * 100),
    })),
    totalVotes: state.totalVotes,
  };
}

// Unified card data fetcher
export type CardData = CountdownData | MultiplierData | StatsData | VotingData;

export async function getCardData(appId: string, cardType: CardType, chainId: ChainId): Promise<CardData | null> {
  switch (cardType) {
    case "live_countdown":
      return getCountdownData(appId, chainId);
    case "live_multiplier":
      return getMultiplierData(appId, chainId);
    case "live_stats":
      return getStatsData(appId, chainId);
    case "live_voting":
      return getVotingData(appId, chainId);
    default:
      return null;
  }
}
