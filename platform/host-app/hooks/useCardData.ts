/**
 * Hook to provide dynamic card data for MiniApps
 * Uses real chain data only - no mock fallback
 */
import { useState, useEffect, useCallback } from "react";
import type { AnyCardData, CardDisplayType } from "@/types/card-display";
import type { ChainId } from "@/lib/chains/types";
import { getCountdownData, getMultiplierData, getStatsData, getVotingData } from "@/lib/card-data";

// Map app_id to card display type
const APP_CARD_TYPES: Record<string, CardDisplayType> = {
  // Countdown type (lottery, auctions)
  "miniapp-lottery": "live_countdown",
  "miniapp-doomsday-clock": "live_countdown",
  "miniapp-time-capsule": "live_countdown",

  // Multiplier type (crash games)
  "miniapp-neo-crash": "live_multiplier",

  // Canvas type
  "miniapp-canvas": "live_canvas",
  "miniapp-millionpiecemap": "live_canvas",

  // Stats type (red envelope, tipping)
  "miniapp-redenvelope": "live_stats",
  "miniapp-dev-tipping": "live_stats",

  // Voting type (governance)
  "miniapp-govbooster": "live_voting",
  "miniapp-gov-merc": "live_voting",
  "miniapp-masqueradedao": "live_voting",

  // Price type (trading, DeFi)
  "miniapp-flashloan": "live_price",
};

// Fetch real data from chain and transform to expected types
async function fetchRealData(appId: string, type: CardDisplayType, chainId: ChainId): Promise<AnyCardData | null> {
  try {
    switch (type) {
      case "live_countdown": {
        const data = await getCountdownData(appId, chainId);
        return {
          type: "live_countdown",
          endTime: data.endTime,
          jackpot: data.jackpot,
          ticketsSold: data.participants,
          ticketPrice: "1 GAS",
          refreshInterval: 10,
        };
      }
      case "live_multiplier": {
        const data = await getMultiplierData(appId, chainId);
        return {
          type: "live_multiplier",
          currentMultiplier: data.multiplier,
          status: data.multiplier > 1 ? "running" : "waiting",
          playersCount: data.players,
          totalBets: "0 GAS",
          refreshInterval: 1,
        };
      }
      case "live_stats": {
        const data = await getStatsData(appId, chainId);
        return {
          type: "live_stats",
          stats: [
            { label: "TVL", value: data.tvl },
            { label: "24h Volume", value: data.volume24h },
            { label: "Users", value: String(data.users) },
          ],
          refreshInterval: 30,
        };
      }
      case "live_voting": {
        const data = await getVotingData(appId, chainId);
        const yesOption = data.options.find((o) => o.label.toLowerCase().includes("yes"));
        const noOption = data.options.find((o) => o.label.toLowerCase().includes("no"));
        return {
          type: "live_voting",
          proposalTitle: data.title,
          yesVotes: yesOption ? Math.round((yesOption.percentage / 100) * data.totalVotes) : 0,
          noVotes: noOption ? Math.round((noOption.percentage / 100) * data.totalVotes) : 0,
          totalVotes: data.totalVotes,
          endTime: Date.now() + 86400000, // Default 24h from now
          refreshInterval: 15,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Get card data for a single app (async version for real data)
export async function getCardDataAsync(appId: string, chainId: ChainId): Promise<AnyCardData | undefined> {
  const cardType = APP_CARD_TYPES[appId];
  if (!cardType) return undefined;
  const realData = await fetchRealData(appId, cardType, chainId);
  return realData || undefined;
}

// Sync version - returns empty state (for SSR compatibility)
export function getCardData(appId: string): AnyCardData | undefined {
  const cardType = APP_CARD_TYPES[appId];
  if (!cardType) return undefined;
  // Return empty placeholder - real data loaded via hook
  return { type: cardType, refreshInterval: 10 } as AnyCardData;
}

// Hook to get card data with auto-refresh (real data only)
export function useCardData(appId: string, chainId: ChainId) {
  const cardType = APP_CARD_TYPES[appId];
  const [data, setData] = useState<AnyCardData | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cardType) return;

    setLoading(true);
    setError(null);

    try {
      const realData = await fetchRealData(appId, cardType, chainId);
      setData(realData || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, [appId, cardType, chainId]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (!cardType || !data?.refreshInterval) return;
    const interval = setInterval(refresh, data.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [cardType, data?.refreshInterval, refresh]);

  return { data, loading, error, refresh };
}

// Batch get card data for multiple apps
export function getCardDataBatch(appIds: string[]): Record<string, AnyCardData> {
  // Note: This sync version returns placeholder data for SSR
  // Real data should be fetched via useCardData hook with chainId
  const result: Record<string, AnyCardData> = {};
  for (const appId of appIds) {
    const data = getCardData(appId);
    if (data) result[appId] = data;
  }
  return result;
}
