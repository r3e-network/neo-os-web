/**
 * Card Display Types for MiniApp Cards
 */

// Display type enum
export type CardDisplayType =
  | "static_banner" // Static image banner
  | "live_countdown" // Countdown timer (lottery, auctions)
  | "live_multiplier" // Growing multiplier (crash games)
  | "live_canvas" // Canvas preview
  | "live_stats" // Real-time statistics
  | "live_voting" // Voting progress
  | "live_price"; // Price chart

// Base card data interface
export interface CardDisplayData {
  type: CardDisplayType;
  refreshInterval?: number; // seconds
}

// Countdown display data
export interface CountdownData extends CardDisplayData {
  type: "live_countdown";
  endTime: number; // Unix timestamp
  jackpot: string; // Amount in GAS
  ticketsSold: number;
  ticketPrice: string;
}

// Multiplier display data (crash game)
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
  pixels: string; // Base64 or hex encoded pixel data
  width: number;
  height: number;
  activeUsers: number;
}

// Stats display data
export interface StatsData extends CardDisplayData {
  type: "live_stats";
  stats: Array<{
    label: string;
    value: string;
    change?: number; // Percentage change
    icon?: string;
  }>;
}

// Voting display data
export interface VotingData extends CardDisplayData {
  type: "live_voting";
  proposalTitle: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  endTime: number;
}

// Price display data
export interface PriceData extends CardDisplayData {
  type: "live_price";
  symbol: string;
  price: string;
  change24h: number;
  sparkline: number[]; // Last 24 data points
}

// Union type for all card data
export type AnyCardData = CountdownData | MultiplierData | CanvasData | StatsData | VotingData | PriceData;
