/**
 * Mock Card Data Provider
 */
import type { CountdownData, MultiplierData, CanvasData, StatsData, VotingData, PriceData } from "./card-types";

// Generate mock countdown data (Lottery)
export function mockCountdownData(): CountdownData {
  const now = Date.now();
  const endTime = now + 3600000 + Math.random() * 7200000; // 1-3 hours
  return {
    type: "live_countdown",
    refreshInterval: 1,
    endTime: Math.floor(endTime / 1000),
    jackpot: (1000 + Math.random() * 9000).toFixed(2),
    ticketsSold: Math.floor(100 + Math.random() * 500),
    ticketPrice: "0.1",
  };
}

// Generate mock multiplier data (Crash)
export function mockMultiplierData(): MultiplierData {
  const statuses: Array<"waiting" | "running" | "crashed"> = ["waiting", "running", "crashed"];
  return {
    type: "live_multiplier",
    refreshInterval: 0.1,
    currentMultiplier: 1 + Math.random() * 5,
    status: statuses[Math.floor(Math.random() * 3)],
    playersCount: Math.floor(10 + Math.random() * 50),
    totalBets: (100 + Math.random() * 900).toFixed(2),
  };
}

// Generate mock canvas data
export function mockCanvasData(): CanvasData {
  return {
    type: "live_canvas",
    refreshInterval: 5,
    pixels: generateRandomPixels(32, 32),
    width: 32,
    height: 32,
    activeUsers: Math.floor(5 + Math.random() * 20),
  };
}

function generateRandomPixels(w: number, h: number): string {
  const colors = ["#10b981", "#3b82f6", "#ec4899", "#f59e0b", "#8b5cf6"];
  let data = "";
  for (let i = 0; i < w * h; i++) {
    data += colors[Math.floor(Math.random() * colors.length)].slice(1);
  }
  return data;
}

// Generate mock stats data (Red Envelope)
export function mockStatsData(): StatsData {
  return {
    type: "live_stats",
    refreshInterval: 10,
    stats: [
      { label: "Available", value: String(Math.floor(5 + Math.random() * 20)), icon: "🧧" },
      { label: "Total GAS", value: (50 + Math.random() * 200).toFixed(1), change: 12.5 },
      { label: "Claimed", value: String(Math.floor(100 + Math.random() * 500)) },
    ],
  };
}

// Generate mock voting data (Gov Booster)
export function mockVotingData(): VotingData {
  const total = Math.floor(1000 + Math.random() * 5000);
  const yes = Math.floor(total * (0.3 + Math.random() * 0.5));
  return {
    type: "live_voting",
    refreshInterval: 30,
    proposalTitle: "Increase staking rewards",
    yesVotes: yes,
    noVotes: total - yes,
    totalVotes: total,
    endTime: Math.floor((Date.now() + 86400000 * 3) / 1000),
  };
}

// Generate mock price data (Price Ticker)
export function mockPriceData(): PriceData {
  const base = 10 + Math.random() * 5;
  return {
    type: "live_price",
    refreshInterval: 5,
    symbol: "NEO-USD",
    price: base.toFixed(2),
    change24h: -5 + Math.random() * 10,
    sparkline: Array.from({ length: 24 }, () => base * (0.95 + Math.random() * 0.1)),
  };
}
