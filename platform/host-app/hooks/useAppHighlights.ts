/**
 * useAppHighlights Hook
 * Fetches dynamic highlight data for MiniApp cards from Supabase
 * No static/mock data - all data comes from database
 */

import { useState, useEffect, useCallback } from "react";
import type { HighlightData } from "@/components/features/miniapp/DynamicBanner";
import { getAppHighlights, updateHighlightsCache } from "@/lib/app-highlights";

interface UseAppHighlightsResult {
  highlights: HighlightData[] | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAppHighlights(appId: string): UseAppHighlightsResult {
  const [highlights, setHighlights] = useState<HighlightData[] | undefined>(() => getAppHighlights(appId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/miniapps/highlights?app_ids=${appId}`);
      if (!response.ok) throw new Error("Failed to fetch highlights");

      const data = await response.json();
      const appHighlights = data.highlights?.[appId] || undefined;
      setHighlights(appHighlights);

      // Update cache for sync access
      if (appHighlights) {
        updateHighlightsCache(appId, appHighlights);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setHighlights((current) => current ?? getAppHighlights(appId));
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    setHighlights(getAppHighlights(appId));
    refresh();
  }, [appId, refresh]);

  return { highlights, loading, error, refresh };
}
