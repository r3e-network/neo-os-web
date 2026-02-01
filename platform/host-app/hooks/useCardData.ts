import { useEffect, useState, useCallback } from "react";
import type { ChainId } from "@/lib/chains/types";
import {
  getCardData as fetchCardData,
  getAppCardType,
  hasCardData,
  getAppsWithCardData,
  type CardType,
  type CardData,
  type CountdownData,
  type MultiplierData,
  type StatsData,
  type VotingData,
} from "@/lib/card-data";

export type { CardType, CardData, CountdownData, MultiplierData, StatsData, VotingData };

export type UseCardDataResult = {
  data?: CardData;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Get card configuration for a single app (static lookup)
 * Returns the card type configuration, not live data
 */
export function getCardData(appId: string): { appId: string; type: CardType } | undefined {
  const type = getAppCardType(appId);
  if (!type) return undefined;
  return { appId, type };
}

/**
 * Get card configuration for multiple apps (static lookup)
 * Returns the card type configurations, not live data
 */
export function getCardDataBatch(appIds: string[]): Record<string, { appId: string; type: CardType }> {
  return appIds.reduce<Record<string, { appId: string; type: CardType }>>((acc, appId) => {
    const data = getCardData(appId);
    if (data) acc[appId] = data;
    return acc;
  }, {});
}

/**
 * Hook to fetch real-time card data for a MiniApp
 * Fetches live data from blockchain based on app type
 */
export function useCardData(appId: string | null, chainId: ChainId): UseCardDataResult {
  const [data, setData] = useState<CardData | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!appId) {
      setData(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    // Check if this app has card data
    const cardType = getAppCardType(appId);
    if (!cardType) {
      setData(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardData = await fetchCardData(appId, cardType, chainId);
      if (cardData) {
        setData(cardData);
      } else {
        setError("No data available");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch card data");
    } finally {
      setLoading(false);
    }
  }, [appId, chainId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook to fetch card data for multiple apps
 */
export function useBatchCardData(
  appIds: string[],
  chainId: ChainId,
): {
  data: Record<string, CardData>;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<Record<string, CardData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appIds.length === 0) {
      setData({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchBatch = async () => {
      const results: Record<string, CardData> = {};

      for (const appId of appIds) {
        if (cancelled) return;

        const cardType = getAppCardType(appId);
        if (!cardType) continue;

        try {
          const cardData = await fetchCardData(appId, cardType, chainId);
          if (cardData) {
            results[appId] = cardData;
          }
        } catch {
          // Skip failed fetches
        }
      }

      if (!cancelled) {
        setData(results);
        setLoading(false);
      }
    };

    fetchBatch();

    return () => {
      cancelled = true;
    };
  }, [appIds, chainId]);

  return { data, loading, error };
}

/**
 * Check if an app has live card data available
 */
export function useHasCardData(appId: string): boolean {
  return hasCardData(appId);
}

/**
 * Get the list of apps that have live card data
 */
export function useAppsWithCardData(): string[] {
  return getAppsWithCardData();
}

export default useCardData;
