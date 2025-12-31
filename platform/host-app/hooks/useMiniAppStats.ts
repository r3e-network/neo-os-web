/**
 * useMiniAppStats Hook
 *
 * Fetches MiniApp statistics from Supabase with real-time updates.
 * Part of the Supabase middleware architecture for frontend-backend decoupling.
 */

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface MiniAppStats {
  app_id: string;
  active_users_daily: number;
  active_users_weekly: number;
  total_unique_users: number;
  total_transactions: number;
  transactions_24h: number;
  total_volume_gas: string;
  volume_24h_gas: string;
  live_data?: Record<string, unknown>;
  rating: number;
  rating_count: number;
  last_activity_at?: string;
}

interface UseMiniAppStatsReturn {
  stats: MiniAppStats | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMiniAppStats(appId: string): UseMiniAppStatsReturn {
  const [stats, setStats] = useState<MiniAppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = async () => {
    if (!isSupabaseConfigured || !appId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from("miniapp_stats").select("*").eq("app_id", appId).single();

      if (fetchError) throw fetchError;
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch stats"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [appId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isSupabaseConfigured || !appId) return;

    const channel = supabase
      .channel(`stats:${appId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "miniapp_stats",
          filter: `app_id=eq.${appId}`,
        },
        (payload) => {
          setStats(payload.new as MiniAppStats);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appId]);

  return { stats, loading, error, refetch: fetchStats };
}
