/**
 * useAppHighlights Hook
 * Fetches dynamic highlight data for MiniApp cards
 */

import { useState, useEffect, useCallback } from "react";
import type { HighlightData } from "@/components/features/miniapp/DynamicBanner";
import { getAppHighlights } from "@/lib/app-highlights";

interface UseAppHighlightsResult {
  highlights: HighlightData[] | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAppHighlights(appId: string): UseAppHighlightsResult {
  const [highlights, setHighlights] = useState<HighlightData[] | undefined>(() => getAppHighlights(appId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/app-highlights/${appId}`);
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setHighlights(data.highlights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Keep static fallback on error
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { highlights, loading, error, refresh };
}
