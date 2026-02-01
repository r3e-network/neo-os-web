import { useEffect, useState } from "react";
import type { AppHighlight} from "@/lib/app-highlights";
import { getAppHighlights } from "@/lib/app-highlights";

export type UseAppHighlightsResult = {
  highlights: AppHighlight[];
  error: string | null;
};

export function useAppHighlights(appId?: string): UseAppHighlightsResult {
  const [highlights, setHighlights] = useState<AppHighlight[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) {
      setHighlights([]);
      setError(null);
      return;
    }

    const fallbackHighlights = getAppHighlights(appId);
    setHighlights(fallbackHighlights);
    setError(null);

    let cancelled = false;

    fetch(`/api/app-highlights/${encodeURIComponent(appId)}`)
      .then((res) => {
        if (res && typeof res.ok === "boolean" && !res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.highlights) && data.highlights.length > 0) {
          setHighlights(data.highlights);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  return { highlights, error };
}
