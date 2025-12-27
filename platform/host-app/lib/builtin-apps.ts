import type { MiniAppInfo } from "../components/types";

/**
 * Built-in MiniApp catalog - fallback data for apps that may not have
 * complete metadata in the database yet.
 *
 * This serves as:
 * 1. Default display data before API response
 * 2. Fallback for built-in apps without database entries
 * 3. Development/testing reference data
 */
export const BUILTIN_APPS: MiniAppInfo[] = [
  {
    app_id: "builtin-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair randomness",
    icon: "🎰",
    category: "gaming",
    entry_url: "mf://builtin?app=builtin-lottery",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-coin-flip",
    name: "Coin Flip",
    description: "50/50 coin flip - double your GAS",
    icon: "🪙",
    category: "gaming",
    entry_url: "mf://builtin?app=builtin-coin-flip",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-dice-game",
    name: "Dice Game",
    description: "Roll the dice and win up to 6x",
    icon: "🎲",
    category: "gaming",
    entry_url: "mf://builtin?app=builtin-dice-game",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-prediction-market",
    name: "Prediction Market",
    description: "Bet on real-world events",
    icon: "📊",
    category: "defi",
    entry_url: "mf://builtin?app=builtin-prediction-market",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "builtin-price-ticker",
    name: "Price Ticker",
    description: "Real-time GAS/NEO price",
    icon: "💹",
    category: "utility",
    entry_url: "mf://builtin?app=builtin-price-ticker",
    permissions: { datafeed: true },
  },
  {
    app_id: "builtin-secret-vote",
    name: "Secret Vote",
    description: "Vote on governance proposals",
    icon: "🗳️",
    category: "governance",
    entry_url: "mf://builtin?app=builtin-secret-vote",
    permissions: { governance: true },
  },
];

/**
 * Get built-in apps as a lookup map by app_id
 */
export const BUILTIN_APPS_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  BUILTIN_APPS.map((app) => [app.app_id, app]),
);

/**
 * Find a built-in app by ID
 */
export function getBuiltinApp(appId: string): MiniAppInfo | undefined {
  return BUILTIN_APPS_MAP[appId];
}
