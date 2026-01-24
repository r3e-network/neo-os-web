export type AppHighlight = {
  label: string;
  value: string;
  icon?: string;
};

const STATIC_HIGHLIGHTS: Record<string, AppHighlight[]> = {
  "miniapp-neoburger": [
    { label: "APR", value: "--" },
    { label: "Total Staked", value: "--" },
  ],
  "miniapp-lottery": [
    { label: "Players", value: "--" },
    { label: "Transactions", value: "--" },
  ],
};

export function getAppHighlights(appId: string): AppHighlight[] {
  const highlights = STATIC_HIGHLIGHTS[appId];
  return highlights ? highlights.map((highlight) => ({ ...highlight })) : [];
}

export function buildStatsHighlights(stats: {
  total_users?: number;
  total_transactions?: number;
  total_gas_used?: string;
}): AppHighlight[] {
  return [
    { label: "Players", value: String(stats.total_users ?? 0) },
    { label: "Transactions", value: String(stats.total_transactions ?? 0) },
    { label: "GAS Used", value: stats.total_gas_used ?? "0" },
  ];
}
