"use client";

import { useState, useCallback } from "react";
import type { SocialRating, SocialComment, VoteType } from "@/components/types";
import { logger } from "@/lib/logger";
import { fetchJSON, fetchOK, toApiError } from "@/lib/fetch-client";

interface UseReviewsOptions {
  appId: string;
  walletAddress?: string;
  network?: "mainnet" | "testnet";
}

export function useReviews({ appId, walletAddress, network = "testnet" }: UseReviewsOptions) {
  const [rating, setRating] = useState<SocialRating | null>(null);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchRating = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams({ network });
      if (walletAddress) params.set("wallet", walletAddress);
      const url = `/api/miniapps/${encodeURIComponent(appId)}/reviews/ratings?${params.toString()}`;
      const data = await fetchJSON<{ rating?: SocialRating }>(url, { signal });
      setRating(data.rating ?? null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      logger.warn("Failed to fetch rating:", err);
    }
  }, [appId, network, walletAddress]);

  const fetchComments = useCallback(
    async (offset = 0, signal?: AbortSignal) => {
      setLoading(true);
      try {
        const data = await fetchJSON<{ comments?: SocialComment[]; hasMore?: boolean }>(
          `/api/miniapps/${encodeURIComponent(appId)}/reviews/comments?limit=20&offset=${offset}&network=${encodeURIComponent(network)}`,
          { signal },
        );
        if (offset === 0) {
          setComments(data.comments || []);
        } else {
          setComments((prev) => [...prev, ...(data.comments || [])]);
        }
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(toApiError(err).message);
      } finally {
        setLoading(false);
      }
    },
    [appId, network],
  );

  const submitRating = useCallback(
    async (value: number, review?: string): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/ratings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, value, review, network }),
        });
        await fetchRating();
        return true;
      } catch (err) {
        setError(toApiError(err).message);
      }
      return false;
    },
    [appId, walletAddress, fetchRating, network],
  );

  const createComment = useCallback(
    async (content: string): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, content, network }),
        });
        await fetchComments(0);
        return true;
      } catch (err) {
        setError(toApiError(err).message);
      }
      return false;
    },
    [appId, walletAddress, fetchComments, network],
  );

  const voteComment = useCallback(
    async (commentId: string, voteType: VoteType): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/${encodeURIComponent(commentId)}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, vote_type: voteType, network }),
        });
        return true;
      } catch (err) {
        logger.warn("Vote failed:", err);
        return false;
      }
    },
    [appId, walletAddress, network],
  );

  const replyComment = useCallback(
    async (parentId: string, content: string): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, content, parent_id: parentId, network }),
        });
        return true;
      } catch (err) {
        logger.warn("Reply failed:", err);
        return false;
      }
    },
    [appId, walletAddress, network],
  );

  const loadReplies = useCallback(
    async (parentId: string): Promise<SocialComment[]> => {
      try {
        const data = await fetchJSON<{ comments?: SocialComment[] }>(
          `/api/miniapps/${encodeURIComponent(appId)}/reviews/comments?parent_id=${encodeURIComponent(parentId)}&network=${encodeURIComponent(network)}`,
        );
        return data.comments || [];
      } catch (err) {
        logger.warn("Failed to load replies:", err);
      }
      return [];
    },
    [appId, network],
  );

  const loadMore = useCallback(async () => {
    await fetchComments(comments.length);
  }, [fetchComments, comments.length]);

  const clearError = useCallback(() => setError(null), []);

  return {
    rating,
    comments,
    loading,
    error,
    hasMore,
    fetchRating,
    fetchComments,
    submitRating,
    createComment,
    voteComment,
    replyComment,
    loadReplies,
    loadMore,
    clearError,
  };
}
