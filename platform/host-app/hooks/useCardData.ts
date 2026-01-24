import { useEffect, useState } from "react";
import type { ChainId } from "@/lib/chains/types";
import {
  getCountdownData,
  getMultiplierData,
  getStatsData,
  getVotingData,
  type CountdownData,
  type MultiplierData,
  type StatsData,
  type VotingData,
} from "@/lib/card-data";

export type CardDataType = "live_countdown" | "live_multiplier" | "live_stats" | "live_voting";

export type CardDataPayload = CountdownData | MultiplierData | StatsData | VotingData;

export type CardData = {
  appId: string;
  type: CardDataType;
  payload?: CardDataPayload;
};

export type UseCardDataResult = {
  data?: CardData;
  loading: boolean;
  error: string | null;
};

const CARD_DATA_BY_APP: Record<string, CardDataType> = {
  "miniapp-lottery": "live_countdown",
  "miniapp-neo-crash": "live_multiplier",
  "miniapp-redenvelope": "live_stats",
  "miniapp-govbooster": "live_voting",
};

export function getCardData(appId: string): CardData | undefined {
  const type = CARD_DATA_BY_APP[appId];
  if (!type) return undefined;
  return { appId, type };
}

export function getCardDataBatch(appIds: string[]): Record<string, CardData> {
  if (!appIds.length) return {};
  return appIds.reduce<Record<string, CardData>>((acc, appId) => {
    const data = getCardData(appId);
    if (data) acc[appId] = data;
    return acc;
  }, {});
}

async function fetchCardPayload(appId: string, chainId: ChainId, type: CardDataType): Promise<CardDataPayload> {
  switch (type) {
    case "live_countdown":
      return getCountdownData(appId, chainId);
    case "live_multiplier":
      return getMultiplierData(appId, chainId);
    case "live_stats":
      return getStatsData(appId, chainId);
    case "live_voting":
      return getVotingData(appId, chainId);
    default:
      return getStatsData(appId, chainId);
  }
}

export function useCardData(appId: string, chainId: ChainId): UseCardDataResult {
  const initialData = appId ? getCardData(appId) : undefined;
  const [data, setData] = useState<CardData | undefined>(initialData);
  const [loading, setLoading] = useState(Boolean(initialData));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const config = appId ? getCardData(appId) : undefined;
    if (!config) {
      setData(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setData(config);
    setLoading(true);
    setError(null);

    fetchCardPayload(appId, chainId, config.type)
      .then((payload) => {
        if (cancelled) return;
        setData({ ...config, payload });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId, chainId]);

  return { data, loading, error };
}
