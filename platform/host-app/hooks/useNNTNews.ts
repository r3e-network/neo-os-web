/**
 * Hook: useNNTNews
 * Fetches Neo News Today articles from the API
 */
import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";

export interface NNTArticle {
  id: string;
  title: string;
  summary: string;
  link: string;
  pubDate: string;
  imageUrl?: string;
  category?: string;
}

interface UseNNTNewsOptions {
  limit?: number;
  enabled?: boolean;
}

interface UseNNTNewsResult {
  articles: NNTArticle[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNNTNews(options: UseNNTNewsOptions = {}): UseNNTNewsResult {
  const { limit = 10, enabled = true } = options;
  const [articles, setArticles] = useState<NNTArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/nnt-news?limit=${limit}`);
      if (!response.ok) {
        throw new Error("Failed to fetch news");
      }

      const data = await response.json();
      setArticles(data.articles || []);
    } catch (err) {
      logger.error("NNT news fetch error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [limit, enabled]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { articles, loading, error, refetch: fetchNews };
}

export default useNNTNews;
