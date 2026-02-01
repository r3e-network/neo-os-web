/**
 * Dynamic Card Display Types for MiniApp Cards
 */

// Display type enum
export type CardDisplayType =
  | "static_banner"
  | "live_countdown"
  | "live_multiplier"
  | "live_canvas"
  | "live_stats"
  | "live_voting"
  | "live_price";

// Base card data interface
export interface CardDisplayData {
  type: CardDisplayType;
  refreshInterval?: number;
}

// Countdown display data (lottery, auctions)
export interface CountdownData extends CardDisplayData {
  type: "live_countdown";
  endTime: number;
  jackpot: string;
  ticketsSold: number;
  ticketPrice: string;
}

// Multiplier display data (crash games)
export interface MultiplierData extends CardDisplayData {
  type: "live_multiplier";
  currentMultiplier: number;
  status: "waiting" | "running" | "crashed";
  playersCount: number;
  totalBets: string;
}

// Canvas display data
export interface CanvasData extends CardDisplayData {
  type: "live_canvas";
  pixels: string;
  width: number;
  height: number;
  activeUsers: number;
}

// Stats display data (red envelope, tipping)
export interface StatsData extends CardDisplayData {
  type: "live_stats";
  stats: Array<{
    label: string;
    value: string;
    change?: number;
    icon?: string;
  }>;
}

// Voting display data (governance)
export interface VotingData extends CardDisplayData {
  type: "live_voting";
  proposalTitle: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  endTime: number;
}

// Price display data (trading, DeFi)
export interface PriceData extends CardDisplayData {
  type: "live_price";
  symbol: string;
  price: string;
  change24h: number;
  sparkline: number[];
}

// Union type
export type AnyCardData = CountdownData | MultiplierData | CanvasData | StatsData | VotingData | PriceData;
