import type { HighlightData } from "@/components/features/miniapp/DynamicBanner";

/**
 * App-specific highlight data configuration
 * These are default/static values that can be overridden by live API data
 */

export type AppHighlightConfig = {
  appId: string;
  highlights: HighlightData[];
};

// Gaming Apps Highlights
const GAMING_HIGHLIGHTS: AppHighlightConfig[] = [
  {
    appId: "miniapp-lottery",
    highlights: [
      { label: "Jackpot", value: "1,250 GAS", icon: "💰", trend: "up" },
      { label: "Players", value: "2.4K", icon: "👥" },
    ],
  },
  {
    appId: "miniapp-coinflip",
    highlights: [
      { label: "Win Rate", value: "50%", icon: "🎯" },
      { label: "Total Flips", value: "45K", icon: "🪙" },
    ],
  },
  {
    appId: "miniapp-dicegame",
    highlights: [
      { label: "Max Win", value: "10x", icon: "🎲" },
      { label: "Games", value: "12K", icon: "🎮" },
    ],
  },
  {
    appId: "miniapp-scratchcard",
    highlights: [
      { label: "Top Prize", value: "500 GAS", icon: "🎫" },
      { label: "Win Rate", value: "35%", icon: "✨" },
    ],
  },
  {
    appId: "miniapp-secretpoker",
    highlights: [
      { label: "Tables", value: "24", icon: "🃏" },
      { label: "Prize Pool", value: "890 GAS", icon: "💰" },
    ],
  },
  {
    appId: "miniapp-neocrash",
    highlights: [
      { label: "Max Multi", value: "1000x", icon: "🚀" },
      { label: "Avg Crash", value: "2.1x", icon: "📈" },
    ],
  },
  {
    appId: "miniapp-candlewars",
    highlights: [
      { label: "Accuracy", value: "52%", icon: "🎯" },
      { label: "Rounds", value: "8.5K", icon: "🕯️" },
    ],
  },
  {
    appId: "miniapp-fogchess",
    highlights: [
      { label: "Active", value: "156", icon: "♟️" },
      { label: "Matches", value: "3.2K", icon: "🏆" },
    ],
  },
];

// DeFi Apps Highlights
const DEFI_HIGHLIGHTS: AppHighlightConfig[] = [
  {
    appId: "miniapp-neoburger",
    highlights: [
      { label: "APR", value: "12.5%", icon: "📈", trend: "up" },
      { label: "Staked", value: "1.2M NEO", icon: "🍔" },
    ],
  },
  {
    appId: "miniapp-flashloan",
    highlights: [
      { label: "Liquidity", value: "500K GAS", icon: "⚡" },
      { label: "Fee", value: "0.09%", icon: "💵" },
    ],
  },
  {
    appId: "miniapp-aitrader",
    highlights: [
      { label: "ROI", value: "+18.5%", icon: "🤖", trend: "up" },
      { label: "Trades", value: "15K", icon: "📊" },
    ],
  },
  {
    appId: "miniapp-gridbot",
    highlights: [
      { label: "Profit", value: "+8.2%", icon: "📈", trend: "up" },
      { label: "Active Bots", value: "342", icon: "🤖" },
    ],
  },
  {
    appId: "miniapp-bridgeguardian",
    highlights: [
      { label: "Bridged", value: "2.5M", icon: "🌉" },
      { label: "Chains", value: "5", icon: "⛓️" },
    ],
  },
  {
    appId: "miniapp-gascircle",
    highlights: [
      { label: "Pool", value: "125K GAS", icon: "⭕" },
      { label: "Members", value: "1.2K", icon: "👥" },
    ],
  },
  {
    appId: "miniapp-ilguard",
    highlights: [
      { label: "Protected", value: "850K", icon: "🛡️" },
      { label: "Saved", value: "12K GAS", icon: "💰", trend: "up" },
    ],
  },
  {
    appId: "miniapp-darkpool",
    highlights: [
      { label: "Volume", value: "1.8M", icon: "🌑" },
      { label: "Trades", value: "5.2K", icon: "🔒" },
    ],
  },
  {
    appId: "miniapp-nolosslottery",
    highlights: [
      { label: "TVL", value: "320K GAS", icon: "🎯" },
      { label: "Winners", value: "156", icon: "🏆" },
    ],
  },
  {
    appId: "miniapp-priceticker",
    highlights: [
      { label: "NEO", value: "$12.45", icon: "📊", trend: "up" },
      { label: "GAS", value: "$4.82", icon: "⛽", trend: "down" },
    ],
  },
  {
    appId: "builtin-prediction-market",
    highlights: [
      { label: "Markets", value: "48", icon: "🔮" },
      { label: "Volume", value: "125K", icon: "💰" },
    ],
  },
];

// Social Apps Highlights
const SOCIAL_HIGHLIGHTS: AppHighlightConfig[] = [
  {
    appId: "miniapp-redenvelope",
    highlights: [
      { label: "Sent", value: "8.5K", icon: "🧧" },
      { label: "Total", value: "45K GAS", icon: "💰" },
    ],
  },
  {
    appId: "miniapp-secretvote",
    highlights: [
      { label: "Polls", value: "234", icon: "🗳️" },
      { label: "Votes", value: "12K", icon: "✅" },
    ],
  },
  {
    appId: "miniapp-devtipping",
    highlights: [
      { label: "Tips", value: "3.2K", icon: "💸" },
      { label: "Devs", value: "456", icon: "👨‍💻" },
    ],
  },
  {
    appId: "miniapp-aisoulmate",
    highlights: [
      { label: "Chats", value: "25K", icon: "💬" },
      { label: "Users", value: "1.8K", icon: "💕" },
    ],
  },
  {
    appId: "miniapp-timecapsule",
    highlights: [
      { label: "Capsules", value: "892", icon: "⏳" },
      { label: "Unlocked", value: "234", icon: "🔓" },
    ],
  },
];

// Governance Apps Highlights
const GOVERNANCE_HIGHLIGHTS: AppHighlightConfig[] = [
  {
    appId: "miniapp-govbooster",
    highlights: [
      { label: "Boosted", value: "2.5M NEO", icon: "🗳️" },
      { label: "Proposals", value: "45", icon: "📜" },
    ],
  },
  {
    appId: "miniapp-guardianpolicy",
    highlights: [
      { label: "Policies", value: "128", icon: "🛡️" },
      { label: "Protected", value: "1.2M", icon: "🔐" },
    ],
  },
  {
    appId: "candidate-vote",
    highlights: [
      { label: "Candidates", value: "21", icon: "👤" },
      { label: "Votes", value: "45M NEO", icon: "🗳️" },
    ],
  },
];

// NFT Apps Highlights
const NFT_HIGHLIGHTS: AppHighlightConfig[] = [
  {
    appId: "miniapp-nftevolve",
    highlights: [
      { label: "Evolved", value: "1.2K", icon: "🔄" },
      { label: "Max Level", value: "10", icon: "⬆️" },
    ],
  },
  {
    appId: "miniapp-canvas",
    highlights: [
      { label: "Pixels", value: "1M", icon: "🎨" },
      { label: "Artists", value: "2.4K", icon: "👨‍🎨" },
    ],
  },
  {
    appId: "miniapp-gardenofneo",
    highlights: [
      { label: "Plants", value: "5.6K", icon: "🌱" },
      { label: "Gardeners", value: "890", icon: "🌸" },
    ],
  },
];

// Utility Apps Highlights
const UTILITY_HIGHLIGHTS: AppHighlightConfig[] = [
  {
    appId: "miniapp-zkbadge",
    highlights: [
      { label: "Badges", value: "12K", icon: "🏅" },
      { label: "Verified", value: "8.5K", icon: "✅" },
    ],
  },
];

// Combine all highlights into a lookup map
const ALL_HIGHLIGHTS: AppHighlightConfig[] = [
  ...GAMING_HIGHLIGHTS,
  ...DEFI_HIGHLIGHTS,
  ...SOCIAL_HIGHLIGHTS,
  ...GOVERNANCE_HIGHLIGHTS,
  ...NFT_HIGHLIGHTS,
  ...UTILITY_HIGHLIGHTS,
];

const HIGHLIGHTS_MAP = new Map<string, HighlightData[]>(
  ALL_HIGHLIGHTS.map((config) => [config.appId, config.highlights]),
);

/**
 * Get highlight data for a specific app
 * Returns undefined if no highlights are configured for the app
 */
export function getAppHighlights(appId: string): HighlightData[] | undefined {
  return HIGHLIGHTS_MAP.get(appId);
}

/**
 * Get highlight data for multiple apps
 * Returns a map of appId -> highlights
 */
export function getAppsHighlights(appIds: string[]): Map<string, HighlightData[]> {
  const result = new Map<string, HighlightData[]>();
  for (const appId of appIds) {
    const highlights = HIGHLIGHTS_MAP.get(appId);
    if (highlights) {
      result.set(appId, highlights);
    }
  }
  return result;
}

/**
 * Generate default highlights based on app stats
 * Used as fallback when no specific highlights are configured
 */
export function generateDefaultHighlights(stats?: {
  users?: number;
  transactions?: number;
  volume?: string;
}): HighlightData[] | undefined {
  if (!stats) return undefined;

  const highlights: HighlightData[] = [];

  if (stats.users && stats.users > 0) {
    highlights.push({
      label: "Users",
      value: formatCompact(stats.users),
      icon: "👥",
    });
  }

  if (stats.transactions && stats.transactions > 0) {
    highlights.push({
      label: "Txs",
      value: formatCompact(stats.transactions),
      icon: "📊",
    });
  }

  if (stats.volume && stats.volume !== "0 GAS") {
    highlights.push({
      label: "Vol",
      value: stats.volume,
      icon: "💰",
    });
  }

  return highlights.length > 0 ? highlights : undefined;
}

function formatCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
