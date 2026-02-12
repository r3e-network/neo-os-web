/**
 * Real Card Data Service
 * Fetches live data from Neo N3 blockchain for MiniApp card displays
 */

import type { ChainId } from "@/lib/chains/types";
import { logger } from "@/lib/logger";
import {
  getLotteryState,
  getGameState,
  getVotingState,
  getContractStats,
  getContractAddress,
  CONTRACTS,
} from "@/lib/chains/contract-queries";

// ============================================================================
// Card Data Types
// ============================================================================

export interface CountdownData {
  type: "live_countdown";
  endTime: number;
  jackpot: string;
  participants: number;
}

export interface MultiplierData {
  type: "live_multiplier";
  multiplier: number;
  players: number;
}

export interface StatsData {
  type: "live_stats";
  tvl: string;
  volume24h: string;
  users: number;
}

export interface VotingData {
  type: "live_voting";
  title: string;
  options: { label: string; percentage: number }[];
  totalVotes: number;
}

export interface CanvasData {
  type: "live_canvas";
  pixelsPainted: number;
  artists: number;
  lastUpdate: number;
}

export interface PriceData {
  type: "live_price";
  price: string;
  change24h: number;
  symbol: string;
}

export type CardType =
  | "live_countdown"
  | "live_multiplier"
  | "live_canvas"
  | "live_stats"
  | "live_voting"
  | "live_price";

export type CardData = CountdownData | MultiplierData | StatsData | VotingData | CanvasData | PriceData;

// ============================================================================
// App to Card Type Mapping
// ============================================================================

const APP_CARD_TYPES: Record<string, CardType> = {
  // Gaming apps with countdown (lottery, sweepstakes)
  "miniapp-lottery": "live_countdown",
  "miniapp-neo-crash": "live_multiplier",
  "miniapp-coinflip": "live_stats",
  "miniapp-dicegame": "live_stats",

  // DeFi apps with stats
  "miniapp-flashloan": "live_stats",
  "miniapp-neoswap": "live_stats",
  "miniapp-neoburger": "live_stats",
  "miniapp-redenvelope": "live_stats",

  // Governance apps with voting
  "miniapp-govbooster": "live_voting",
  "miniapp-secretvote": "live_voting",
  "miniapp-predictionmarket": "live_voting",
  "miniapp-candidate-vote": "live_voting",

  // NFT/Canvas apps
  "miniapp-canvas": "live_canvas",

  // Price feeds
  "miniapp-priceticker": "live_price",
};

// ============================================================================
// Data Fetchers
// ============================================================================

export async function getCountdownData(appId: string, chainId: ChainId): Promise<CountdownData> {
  // Default response
  const defaultData: CountdownData = {
    type: "live_countdown",
    endTime: Date.now() + 86400000,
    jackpot: "0",
    participants: 0,
  };

  try {
    // Get contract address for lottery
    const contractAddress = getContractAddress("lottery", chainId);
    if (!contractAddress) return defaultData;

    const state = await getLotteryState(contractAddress, chainId);

    return {
      type: "live_countdown",
      endTime: state.endTime || Date.now() + 86400000,
      jackpot: state.prizePool || "0",
      participants: state.ticketsSold || 0,
    };
  } catch (err) {
    logger.warn(`[card-data] Failed to get countdown data for ${appId}:`, err);
    return defaultData;
  }
}

export async function getMultiplierData(appId: string, chainId: ChainId): Promise<MultiplierData> {
  const defaultData: MultiplierData = {
    type: "live_multiplier",
    multiplier: 1.0,
    players: 0,
  };

  try {
    // For Neo Crash game
    const contractAddress = getContractAddress("neoCrash", chainId);
    if (!contractAddress) return defaultData;

    const state = await getGameState(contractAddress, chainId);

    return {
      type: "live_multiplier",
      multiplier: state.currentMultiplier || 1.0,
      players: state.playerCount || 0,
    };
  } catch (err) {
    logger.warn(`[card-data] Failed to get multiplier data for ${appId}:`, err);
    return defaultData;
  }
}

export async function getStatsData(appId: string, chainId: ChainId): Promise<StatsData> {
  const defaultData: StatsData = {
    type: "live_stats",
    tvl: "0",
    volume24h: "0",
    users: 0,
  };

  try {
    // Map app to contract name
    const contractMap: Record<string, string> = {
      "miniapp-flashloan": "flashLoan",
      "miniapp-redenvelope": "redEnvelope",
      "miniapp-coinflip": "coinFlip",
      "miniapp-dicegame": "diceGame",
    };

    const contractName = contractMap[appId];
    if (!contractName) return defaultData;

    const contractAddress = getContractAddress(contractName, chainId);
    if (!contractAddress) return defaultData;

    const stats = await getContractStats(contractAddress, chainId);

    return {
      type: "live_stats",
      tvl: stats.totalValueLocked || "0",
      volume24h: "0", // Would need historical data
      users: stats.uniqueUsers || 0,
    };
  } catch (err) {
    logger.warn(`[card-data] Failed to get stats data for ${appId}:`, err);
    return defaultData;
  }
}

export async function getVotingData(appId: string, chainId: ChainId): Promise<VotingData> {
  const defaultData: VotingData = {
    type: "live_voting",
    title: "No Active Proposal",
    options: [],
    totalVotes: 0,
  };

  try {
    const contractAddress = getContractAddress("secretVote", chainId);
    if (!contractAddress) return defaultData;

    const state = await getVotingState(contractAddress, chainId);

    // Calculate percentages from vote counts
    const total = state.options.reduce((sum, opt) => sum + opt.votes, 0);
    const optionsWithPercentage = state.options.map((opt) => ({
      label: opt.label,
      percentage: total > 0 ? Math.round((opt.votes / total) * 100) : 0,
    }));

    return {
      type: "live_voting",
      title: state.title || "Active Proposal",
      options: optionsWithPercentage,
      totalVotes: total,
    };
  } catch (err) {
    logger.warn(`[card-data] Failed to get voting data for ${appId}:`, err);
    return defaultData;
  }
}

export async function getCanvasData(_appId: string, _chainId: ChainId): Promise<CanvasData> {
  // Canvas data would require a specific contract query
  // For now, return placeholder
  return {
    type: "live_canvas",
    pixelsPainted: 0,
    artists: 0,
    lastUpdate: Date.now(),
  };
}

export async function getPriceData(_appId: string, _chainId: ChainId): Promise<PriceData> {
  // Price data would come from oracle/price feed
  return {
    type: "live_price",
    price: "0.00",
    change24h: 0,
    symbol: "NEO",
  };
}

// ============================================================================
// Main Card Data Fetcher
// ============================================================================

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
    case "live_canvas":
      return getCanvasData(appId, chainId);
    case "live_price":
      return getPriceData(appId, chainId);
    default:
      return null;
  }
}

/**
 * Get the card type for a specific app
 */
export function getAppCardType(appId: string): CardType | null {
  return APP_CARD_TYPES[appId] || null;
}

/**
 * Get all apps that have live card data
 */
export function getAppsWithCardData(): string[] {
  return Object.keys(APP_CARD_TYPES);
}

/**
 * Check if an app has live card data available
 */
export function hasCardData(appId: string): boolean {
  return appId in APP_CARD_TYPES;
}

export { getContractAddress, CONTRACTS };
