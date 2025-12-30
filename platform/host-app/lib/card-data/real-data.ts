/**
 * Real Card Data Service
 * Fetches live data from Neo N3 contracts for card displays
 */

import { getLotteryState, getGameState, getVotingState, getContractStats, CONTRACTS, type Network } from "@/lib/chain";

export type CardType =
  | "live_countdown"
  | "live_multiplier"
  | "live_canvas"
  | "live_stats"
  | "live_voting"
  | "live_price";

// App ID to contract hash mapping
const APP_CONTRACTS: Record<string, string> = {
  "miniapp-lottery": CONTRACTS.lottery,
  "miniapp-coinflip": CONTRACTS.coinFlip,
  "miniapp-dicegame": CONTRACTS.diceGame,
  "miniapp-neocrash": CONTRACTS.neoCrash,
  "miniapp-secretvote": CONTRACTS.secretVote,
  "miniapp-predictionmarket": CONTRACTS.predictionMarket,
  "miniapp-canvas": CONTRACTS.canvas,
  "miniapp-priceticker": CONTRACTS.priceTicker,
};

// Countdown data (Lottery, Auctions)
export interface CountdownData {
  jackpot: string;
  currency: string;
  endTime: number;
  participants: number;
}

export async function getCountdownData(appId: string, network: Network = "testnet"): Promise<CountdownData> {
  const contract = APP_CONTRACTS[appId];
  if (!contract) {
    return { jackpot: "0", currency: "GAS", endTime: 0, participants: 0 };
  }

  const state = await getLotteryState(contract, network);
  return {
    jackpot: state.prizePool,
    currency: "GAS",
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

export async function getMultiplierData(appId: string, network: Network = "testnet"): Promise<MultiplierData> {
  const contract = APP_CONTRACTS[appId];
  if (!contract) {
    return { multiplier: 1.0, trend: "stable", players: 0 };
  }

  const state = await getGameState(contract, network);
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

export async function getStatsData(appId: string, network: Network = "testnet"): Promise<StatsData> {
  const contract = APP_CONTRACTS[appId];
  if (!contract) {
    return { tvl: "0", volume24h: "0", users: 0 };
  }

  const stats = await getContractStats(contract, network);
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

export async function getVotingData(appId: string, network: Network = "testnet"): Promise<VotingData> {
  const contract = APP_CONTRACTS[appId];
  if (!contract) {
    return { title: "No Proposal", options: [], totalVotes: 0 };
  }

  const state = await getVotingState(contract, network);
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

export async function getCardData(
  appId: string,
  cardType: CardType,
  network: Network = "testnet",
): Promise<CardData | null> {
  switch (cardType) {
    case "live_countdown":
      return getCountdownData(appId, network);
    case "live_multiplier":
      return getMultiplierData(appId, network);
    case "live_stats":
      return getStatsData(appId, network);
    case "live_voting":
      return getVotingData(appId, network);
    default:
      return null;
  }
}
