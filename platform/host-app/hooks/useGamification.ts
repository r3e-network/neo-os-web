"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserStats } from "@/components/features/gamification/types";
import { LEVELS } from "@/components/features/gamification/constants";

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

  const fetchStats = useCallback(async () => {
    if (!wallet) {
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/gamification/stats?wallet=${encodeURIComponent(wallet)}`);
      if (!res.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await res.json();
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
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
