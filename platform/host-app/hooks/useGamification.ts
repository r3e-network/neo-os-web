"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UserStats } from "@/components/features/gamification/types";
import { LEVELS } from "@/components/features/gamification/constants";
import { fetchJSON, RequestError, toApiError } from "@/lib/fetch-client";

interface UseGamificationResult {
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  levelInfo: {
    name: string;
    color: string;
    minXP: number;
    maxXP: number;
    progress: number;
  } | null;
  refresh: () => Promise<void>;
}

export function useGamification(wallet?: string): UseGamificationResult {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchStats = useCallback(async () => {
    if (!wallet) {
      if (mountedRef.current) setStats(null);
      return;
    }

    if (mountedRef.current) setLoading(true);
    if (mountedRef.current) setError(null);

    try {
      const data = await fetchJSON<{ stats?: UserStats }>(`/api/gamification/stats?wallet=${encodeURIComponent(wallet)}`);
      if (mountedRef.current) setStats(data.stats ?? null);
    } catch (err) {
      if (mountedRef.current) {
        if (err instanceof RequestError) {
          setError("Failed to fetch stats");
        } else {
          setError(toApiError(err).message);
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const levelInfo = stats
    ? (() => {
        const level = LEVELS.find((l) => l.level === stats.level) || LEVELS[0];
        const nextLevel = LEVELS.find((l) => l.level === stats.level + 1);
        const maxXP = nextLevel?.minXP || level.maxXP;
        const progress = Math.min(100, ((stats.xp - level.minXP) / (maxXP - level.minXP)) * 100);
        return {
          name: level.name,
          color: level.color,
          minXP: level.minXP,
          maxXP,
          progress,
        };
      })()
    : null;

  return {
    stats,
    loading,
    error,
    levelInfo,
    refresh: fetchStats,
  };
}
